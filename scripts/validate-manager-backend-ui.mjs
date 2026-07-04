import { createServer } from 'node:http';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';

const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const DIST_DIR = join(ROOT_DIR, 'dist');
const STATIC_PORTS = [4181, 4182, 4183, 4184, 4185];
const VIEWPORT = { width: 1440, height: 1100 };
const BACKEND_STORE = new URL('../.tmp/agent-manager-backend-ui-store.json', import.meta.url);
const PRESERVE_BACKEND_UI_TMP = process.env.HOFS_MANAGER_BACKEND_UI_PRESERVE_TMP === '1';
const CAPTURE_SUCCESS_SCREENSHOT = process.env.HOFS_MANAGER_BACKEND_UI_SCREENSHOT === '1';
const BACKEND_STORAGE_KEY = 'hall_of_fame_studio.agent_backend_url.v1';
const LANGUAGE_STORAGE_KEY = 'hall_of_fame_studio.language.v1';
const nativeFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = async (...args) => {
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await nativeFetch(...args);
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

function cleanupManagerBackendUiTmp() {
  if (PRESERVE_BACKEND_UI_TMP) return;
  const backendStorePath = fileURLToPath(BACKEND_STORE);
  rmSync(backendStorePath, { force: true });
  rmSync(`${backendStorePath}.security-audit.jsonl`, { force: true });
}

cleanupManagerBackendUiTmp();
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.once(signal, () => {
    cleanupManagerBackendUiTmp();
    process.exit(signal === 'SIGINT' ? 130 : 143);
  });
}

function changeLedgerText(change = {}) {
  return [
    change.text,
    change.requestText,
    change.summary,
    change.title,
  ].filter(Boolean).join(' ');
}

async function waitForBackendSnapshot(url, predicate, message, { timeoutMs = 8000 } = {}) {
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

async function assertPageContains(page, text, message = `Expected page to contain "${text}".`) {
  const visibleMatches = await page.getByText(text, { exact: false }).count();
  if (visibleMatches > 0) return;
  await page.waitForFunction(
    (expectedText) => document.body.innerText.includes(expectedText),
    text,
    { timeout: 8000 },
  ).catch(() => {});
  let bodyText = '';
  try {
    bodyText = await page.locator('body').innerText({ timeout: 5000 });
  } catch {
    bodyText = await page.evaluate(() => document.body?.textContent || '');
  }
  assert(bodyText.includes(text), message);
}

async function withSuppressedBackendTranscriptProof(page, { backendUrl, projectId, channelId = 'main' }, callback) {
  const expectedOrigin = new URL(backendUrl).origin;
  const expectedProjectPath = `/projects/${projectId}/transcripts`;
  const routePattern = '**/*';
  const headers = {
    'access-control-allow-origin': '*',
    'content-type': 'application/json; charset=utf-8',
  };
  let interceptedCount = 0;
  const transcriptHandler = async (route) => {
    const requestedUrl = new URL(route.request().url());
    const requestedPath = decodeURIComponent(requestedUrl.pathname);
    if (
      requestedUrl.origin !== expectedOrigin
      || (requestedPath !== expectedProjectPath && !requestedPath.startsWith(`${expectedProjectPath}/`))
    ) {
      return route.continue();
    }
    interceptedCount += 1;
    if (requestedPath === expectedProjectPath) {
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({
          schemaVersion: 'project-transcript-index/v1',
          projectId,
          channels: [{
            channelId,
            name: channelId,
            messageCount: 0,
            archivedProofCount: 0,
            totalProofCount: 0,
            proofIds: [],
            apiPath: `/projects/${projectId}/transcripts/${channelId}`,
          }],
          proofIds: [],
        }),
      });
    }
    const requestedChannelId = decodeURIComponent(requestedPath.split('/').at(-1) || channelId);
    return route.fulfill({
      status: 200,
      headers,
      body: JSON.stringify({
        schemaVersion: 'project-channel-transcript/v1',
        projectId,
        channelId: requestedChannelId,
        messages: [],
        archivedProofMessages: [],
        proofIds: [],
        messageCount: 0,
        archivedProofCount: 0,
      }),
    });
  };

  const context = page.context();
  await context.route(routePattern, transcriptHandler);
  try {
    await callback();
    assert(interceptedCount > 0, 'Backend transcript negative fixture must intercept at least one transcript request.');
  } finally {
    await context.unroute(routePattern, transcriptHandler);
  }
}

async function withSuppressedBackendFlowGraph(page, { backendUrl, projectId }, callback) {
  const expectedOrigin = new URL(backendUrl).origin;
  const expectedProjectPath = `/projects/${projectId}/manager-flow-graph`;
  const routePattern = '**/*';
  const headers = {
    'access-control-allow-origin': '*',
    'content-type': 'application/json; charset=utf-8',
  };
  let interceptedCount = 0;
  const flowGraphHandler = async (route) => {
    const requestedUrl = new URL(route.request().url());
    const requestedPath = decodeURIComponent(requestedUrl.pathname);
    if (requestedUrl.origin !== expectedOrigin || requestedPath !== expectedProjectPath) {
      return route.continue();
    }
    interceptedCount += 1;
    return route.fulfill({
      status: 200,
      headers,
      body: JSON.stringify({
        schemaVersion: 'manager-flow-graph/v1',
        projectId,
        generatedAt: new Date().toISOString(),
        nodes: [],
        edges: [],
        categories: [],
        summary: {
          nodeCount: 0,
          edgeCount: 0,
          proofedNodeCount: 0,
          confirmedNodeCount: 0,
          blockedNodeCount: 0,
          majorVisibleCount: 0,
          byCategory: {},
        },
        dataSources: {
          negativeFixture: 'missing-flow-read-model',
        },
      }),
    });
  };

  const context = page.context();
  await context.route(routePattern, flowGraphHandler);
  try {
    await callback();
    assert(interceptedCount > 0, 'Backend Flow Graph negative fixture must intercept the Manager Flow Graph request.');
  } finally {
    await context.unroute(routePattern, flowGraphHandler);
  }
}

async function scrollDashboard(page) {
  await page.evaluate(() => {
    [...document.querySelectorAll('.overflow-y-auto')].forEach((element) => {
      element.scrollTop = Math.floor(element.scrollHeight * 0.45);
    });
  });
  await page.waitForTimeout(250);
}

async function scrollDashboardToBottom(page) {
  await page.evaluate(() => {
    [...document.querySelectorAll('.overflow-y-auto')].forEach((element) => {
      element.scrollTop = element.scrollHeight;
    });
  });
  await page.waitForTimeout(250);
}

async function clickDynamic(locator) {
  try {
    await locator.click({ force: true, timeout: 10000 });
  } catch {
    await locator.dispatchEvent('click');
  }
}

async function waitForEnabledTestId(page, testId, timeout = 15000) {
  const selector = `[data-testid="${testId}"]`;
  await page.locator(selector).waitFor({ state: 'visible', timeout });
  await page.waitForFunction((targetSelector) => {
    const button = document.querySelector(targetSelector);
    return Boolean(button && !button.disabled);
  }, selector, { timeout });
  return page.getByTestId(testId);
}

async function clickDashboardStep(page, stepId) {
  const step = page.getByTestId(`manager-demo-step-${stepId}`);
  assert(await step.count() === 1, `Expected manager demo step "${stepId}" to be available.`);
  await step.click();
}

async function waitForBackendLastResult(page, station) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await station.getByRole('button', { name: /Check/i }).click();
    await page.waitForTimeout(400);
    if (await page.getByTestId('backend-last-result').count()) return;
  }
  await page.getByTestId('backend-last-result').waitFor({ state: 'visible', timeout: 5000 });
}

async function backToDashboard(page) {
  const backButton = page.getByTestId('project-scene-back');
  assert(await backButton.count() === 1, 'Project scene must expose one back-to-dashboard control.');
  await backButton.click();
  await page.getByTestId('project-dashboard-view').waitFor({ state: 'visible', timeout: 10000 });
  await scrollDashboardToBottom(page);
}

async function sendChatPrefill(page, expectedChannel, expectedSnippet) {
  const input = page.getByPlaceholder(`Message #${expectedChannel}...`);
  await input.waitFor({ state: 'visible', timeout: 5000 });
  const value = await input.inputValue();
  assert(value.includes(expectedSnippet), `Expected ${expectedChannel} prefill to include "${expectedSnippet}", got "${value}".`);
  await input.press('Enter');
  await page.waitForFunction(
    (placeholder) => {
      const inputElement = [...document.querySelectorAll('input')]
        .find((element) => element.getAttribute('placeholder') === placeholder);
      return inputElement && inputElement.value === '';
    },
    `Message #${expectedChannel}...`,
    { timeout: 5000 },
  );
}

async function sendMeetingPrefill(page, expectedSnippet) {
  const input = page.getByTestId('project-meeting-input');
  await input.waitFor({ state: 'visible', timeout: 5000 });
  const value = await input.inputValue();
  assert(value.includes(expectedSnippet), `Expected meeting prefill to include "${expectedSnippet}", got "${value}".`);
  await input.press('Enter');
  await page.waitForFunction(() => {
    const inputElement = document.querySelector('[data-testid="project-meeting-input"]');
    return inputElement && inputElement.value === '';
  }, null, { timeout: 5000 });
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
        if (attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
        }
      }
    }
  }
  try {
    return await chromium.launch({ channel: 'msedge', headless: true });
  } catch (edgeError) {
    throw new Error(`Could not launch Playwright browser. Bundled Chromium failed: ${lastError?.message || lastError}. Edge fallback failed: ${edgeError?.message || edgeError}`);
  }
}

const backendServer = createAgentProjectHttpServer({
  filePath: BACKEND_STORE,
  replaceWithSeed: true,
});
const backendRuntime = await backendServer.listen();
const staticRuntime = await startStaticServer();
let browser = null;
const consoleErrors = [];
const pageErrors = [];
const walkthroughRequests = [];

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
      consoleErrors.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.stack || error.message);
  });
  page.on('request', (request) => {
    if (request.url().includes('manager-scenario-walkthrough')) {
      walkthroughRequests.push(`request ${request.method()} ${request.url()}`);
    }
  });
  page.on('response', async (response) => {
    if (response.url().includes('manager-scenario-walkthrough')) {
      walkthroughRequests.push(`response ${response.status()} ${response.url()}`);
    }
    if (response.status() >= 400 && /\/(projects|workers)\//.test(response.url())) {
      let bodyText = '';
      try {
        bodyText = (await response.text()).slice(0, 500);
      } catch {
        bodyText = '';
      }
      consoleErrors.push(`http ${response.status()} ${response.url()} ${bodyText}`.trim());
    }
  });

  await page.goto(staticRuntime.url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Load Sample Fixture.*Manager demo data/i }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Manager Demo: Autonomous Agent Studio'), null, { timeout: 10000 });
  await page.getByTestId('project-sample-fixture-banner').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Sample Fixture', 'Manager Demo must be visibly marked as sample fixture data.');
  await scrollDashboardToBottom(page);
  const initialStation = page.getByTestId('backend-worker-station');
  await initialStation.waitFor({ state: 'visible', timeout: 10000 });
  await clickDynamic(initialStation.getByRole('button', { name: /Check/i }));
  await assertPageContains(page, 'Online', 'Backend station must connect before route-backed Manager Demo assertions.');
  const seedSampleButton = await waitForEnabledTestId(page, 'backend-save-project');
  await clickDynamic(seedSampleButton);
  await assertPageContains(page, 'Sample/dev project seeded to backend', 'Manager Demo route-backed assertions must start from a backend-seeded sample project.');
  const seededManagerDemoSnapshot = await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => snapshot.projects.some((item) => item.id === 'p_manager_demo_001' || item.id === 'P_MANAGER_DEMO_001'),
    'Manager Demo sample fixture must be persisted to the backend before route-backed dashboard assertions.',
    { timeoutMs: 15000 },
  );
  const seededManagerDemoProject = seededManagerDemoSnapshot.projects.find((item) => item.id === 'p_manager_demo_001' || item.id === 'P_MANAGER_DEMO_001');
  const seededManagerDemoProjectId = seededManagerDemoProject.id;
  await clickDynamic(page.getByTestId('backend-sync-ready-package'));
  await page.getByTestId('backend-manager-ready-package-snapshot').waitFor({ state: 'visible', timeout: 15000 });
  for (const syncTestId of [
    'backend-sync-manager-view',
    'backend-sync-command-center',
  ]) {
    const syncButton = await waitForEnabledTestId(page, syncTestId);
    await clickDynamic(syncButton);
  }
  for (const syncTestId of [
    'backend-sync-scenario-walkthrough',
    'backend-sync-scenario-trail',
    'backend-sync-requirement-matrix',
    'backend-sync-sync-protocol-audit',
    'backend-sync-use-case-audit',
  ]) {
    const syncButton = await waitForEnabledTestId(page, syncTestId);
    await clickDynamic(syncButton);
  }
  const seededScenarioTrail = await fetch(`${backendRuntime.url}/projects/${encodeURIComponent(seededManagerDemoProjectId)}/manager-scenario-trail`).then((response) => response.json());
  const seededScenarioTrailModel = seededScenarioTrail.managerScenarioTrail || seededScenarioTrail;
  assert(
    seededScenarioTrailModel?.rows?.some((row) => row.id === 'kickoff-brief'),
    'Backend Manager Scenario Trail must expose kickoff brief proof before route-backed dashboard assertions.',
  );
  await scrollDashboard(page);

  await page.getByTestId('scenario-control-center').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Scenario Control Center', 'Manager dashboard must expose a guided scenario control center.');
  await assertPageContains(page, 'Kickoff Decisions', 'Scenario control center must start from kickoff decisions.');
  await assertPageContains(page, '24/7 Work Pulse', 'Scenario control center must expose the autonomous work pulse step.');
  await assertPageContains(page, 'Agent Management Sync', 'Scenario control center must expose the Agent management sync step.');
  await assertPageContains(page, 'Mid-project Change Intake', 'Scenario control center must expose change intake.');
  await assertPageContains(page, 'Manager Evidence Exit', 'Scenario control center must expose final proof-map exit.');
  await assertPageContains(page, '5/5 Agent receipts', 'Scenario control center must show all Agents received kickoff next-action decisions.');
  await page.getByTestId('scenario-control-action-evidence').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('manager-live-command-center').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Manager Live Command Center', 'Manager dashboard must expose a live command center.');
  await assertPageContains(page, 'demo data', 'Manager Demo command center must expose explicit demo-data provenance.');
  await assertPageContains(page, 'Next best action:', 'Manager command center must show the next best action.');
  await assertPageContains(page, 'Kickoff Decision Board', 'Manager command center must expose kickoff decision closure.');
  await assertPageContains(page, 'Leader Marker', 'Manager command center must expose Leader marker readiness.');
  await page.getByTestId('manager-command-kickoff-next-actions').waitFor({ state: 'visible', timeout: 5000 });
  const kickoffNextActionsText = await page.getByTestId('manager-command-kickoff-next-actions').innerText();
  assert(kickoffNextActionsText.trim().length > 0, 'Manager command center must expose kickoff next-action confirmation row.');
  await page.getByTestId('manager-command-kickoff-proof-next-actions').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Kickoff proof', 'Manager command center must expose kickoff proof exits.');
  await assertPageContains(page, 'Work Loop Board', 'Manager command center must expose 24/7 work-loop proof.');
  await assertPageContains(page, 'Loop proof', 'Manager command center must expose work-loop timeline proof exits.');
  await assertPageContains(page, 'Collaboration Board', 'Manager command center must expose live collaboration proof.');
  await assertPageContains(page, 'Leader @assignments', 'Manager command center must summarize Leader group @assignments.');
  await assertPageContains(page, 'Collaboration proof', 'Manager command center must expose collaboration timeline proof exits.');
  await assertPageContains(page, 'Change Protocol Board', 'Manager command center must expose the dual-channel change protocol.');
  await page.getByTestId('manager-command-change-protocol-owner-plan').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('manager-command-change-protocol-team-resync').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('manager-command-change-protocol-proof-owner-plan').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Attention Queue', 'Manager command center must expose action and risk attention rows.');
  await assertPageContains(page, 'Agent Readiness', 'Manager command center must expose per-Agent readiness rows.');
  await assertPageContains(page, 'Latest @Signal', 'Manager command center must expose the latest @signal received by each Agent.');
  await assertPageContains(page, 'Work Started', 'Manager command center must expose whether the Agent started work from the signal.');
  await assertPageContains(page, 'Signal proof', 'Manager command center must expose Agent signal proof exits.');
  await assertPageContains(page, 'Work proof', 'Manager command center must expose Agent work proof exits.');
  await assertPageContains(page, 'Change Owner Sync', 'Manager command center must expose change owner sync rows.');
  await assertPageContains(page, 'Owner Confirmed', 'Manager command center must expose owner confirmation state.');
  await assertPageContains(page, 'Plan Updated', 'Manager command center must expose owner plan state.');
  await assertPageContains(page, 'Team Synced', 'Manager command center must expose team sync state.');
  await assertPageContains(page, 'Owner Work', 'Manager command center must expose owner work state.');
  await page.getByTestId('manager-command-run-next').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('manager-command-lane-workers').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('manager-command-lane-google-chat').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('manager-scenario-walkthrough').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Manager Scenario Walkthrough', 'Manager dashboard must expose a guided scenario walkthrough.');
  await assertPageContains(page, 'A single guided path from kickoff meeting to 24/7 Agent work, change intake, and mutual management.', 'Manager walkthrough must explain the full story path.');
  await assertPageContains(page, 'Primary action:', 'Manager walkthrough must map stages to primary Action Queue actions.');
  await assertPageContains(page, 'Next Gap', 'Manager walkthrough must separate unfinished gaps from rerunnable steps.');
  await assertPageContains(page, 'Rerunnable', 'Manager walkthrough must expose repeat-safe operational steps separately.');
  await assertPageContains(page, 'All covered', 'Manager walkthrough must show a clear all-covered completion state.');
  await assertPageContains(page, 'Run walkthrough step', 'Manager walkthrough must expose runnable step buttons.');
  await assertPageContains(page, 'Walkthrough proof', 'Manager walkthrough must expose proof exits.');
  await page.getByTestId('manager-action-playbook').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Manager Action Playbook', 'Manager dashboard must expose a route-backed action playbook.');
  await assertPageContains(page, 'Run Action', 'Manager action playbook must expose executable backend action buttons.');
  await assertPageContains(page, 'Run Again', 'Manager action playbook must let managers rerun completed operational actions.');
  await assertPageContains(page, 'rerunnable', 'Manager action playbook must mark repeat-safe operational actions.');
  await assertPageContains(page, 'Open Step', 'Manager action playbook must expose proof or UI step buttons.');
  await assertPageContains(page, 'route resolved', 'Manager action playbook must show whether backend routes are directly callable.');
  await assertPageContains(page, 'Run route:', 'Manager action playbook must show the backend run endpoint for executable actions.');
  await assertPageContains(page, 'Body template:', 'Manager action playbook must show request body templates for runnable actions.');
  await assertPageContains(page, 'Manager Action Run Ledger', 'Manager dashboard must expose Action Queue execution receipts.');
  await assertPageContains(page, 'No Playbook runs yet', 'Manager action run ledger must explain the pre-run empty state.');
  await page.getByTestId('manager-scenario-trail').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Manager Scenario Trail', 'Manager dashboard must expose an end-to-end scenario trail.');
  await page.getByTestId('manager-scenario-trail-row-kickoff-brief').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('manager-scenario-trail-row-leader-confirmed').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('manager-scenario-trail-row-assignment-progress').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('manager-scenario-trail-row-dual-channel-change').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('sync-protocol-audit').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Sync Protocol Audit', 'Manager dashboard must expose the backend sync protocol audit.');
  await assertPageContains(page, 'Backend collaboration protocol', 'Sync protocol audit must explain source-to-ledger collaboration coverage.');
  await assertPageContains(page, 'Agent State', 'Sync protocol audit must expose Agent state write coverage.');
  await assertPageContains(page, 'Ledger', 'Sync protocol audit must expose event-ledger coverage.');
  await page.getByTestId('manager-use-case-audit').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Manager Use Case Audit', 'Manager dashboard must expose a manager-readable use case audit.');
  await assertPageContains(page, 'The user story translated into manager-readable coverage checks and proof exits.', 'Manager use case audit must explain its purpose.');
  await assertPageContains(page, 'Group @Assignment', 'Manager use case audit must include group @assignment coverage.');
  await assertPageContains(page, 'Next action:', 'Manager use case audit must show the Action Queue next action for each story stage.');
  await assertPageContains(page, 'Run use case action', 'Manager use case audit must expose runnable use-case actions.');
  await assertPageContains(page, 'Use case proof', 'Manager use case audit must expose proof exits.');
  await page.getByTestId('manager-requirement-matrix').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Manager Requirement Matrix', 'Manager dashboard must expose requested condition coverage.');
  await page.getByTestId('manager-requirement-row-kickoff-brief-understood').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('manager-requirement-row-leader-group-assignment').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('manager-requirement-row-owner-plan-and-team-sync').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('manager-requirement-proof-leader-group-assignment').click();
  await assertPageContains(page, 'PROOF FOCUS:', 'Manager requirement matrix proof must jump to exact evidence.');
  await backToDashboard(page);
  await scrollDashboard(page);
  await assertPageContains(page, 'Sync Trail', 'Backend Worker Station must expose a standalone scenario trail sync action.');
  await assertPageContains(page, 'Sync Package', 'Backend Worker Station must expose a manager ready package sync action.');
  await assertPageContains(page, 'Sync Proof Models', 'Backend Worker Station must expose standalone proof submodel sync actions.');
  await assertPageContains(page, 'Sync Audit', 'Backend Worker Station must expose a standalone use case audit sync action.');
  await assertPageContains(page, 'Sync Timeline', 'Backend Worker Station must expose a backend timeline/event sync action.');
  await page.getByTestId('manager-scenario-trail-proof-kickoff-brief').click();
  await assertPageContains(page, 'PROOF FOCUS:', 'Manager scenario trail kickoff proof must jump to exact chat evidence.');
  await backToDashboard(page);
  await scrollDashboard(page);
  await page.getByTestId('manager-change-intake-composer').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Manager Change Intake', 'Manager dashboard must expose a custom change intake composer.');
  await assertPageContains(page, 'Submit Change', 'Manager change intake composer must expose a submit action.');
  await page.getByTestId('manager-leader-assignment-composer').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Leader Assignment Composer', 'Manager dashboard must expose a custom Leader assignment composer.');
  await assertPageContains(page, 'Submit Assignment', 'Leader assignment composer must expose a submit action.');

  const station = page.getByTestId('backend-worker-station');
  await station.waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Fixed Work Routines', 'Manager dashboard must expose fixed Agent routines.');
  await page.getByTestId('routine-row-turing').waitFor({ state: 'visible', timeout: 5000 });
  const backendInput = page.getByTestId('backend-url-input');
  assert(await backendInput.inputValue() === backendRuntime.url, 'Backend Worker Station must load the configured backend URL.');
  await station.getByRole('button', { name: /Check/i }).click();
  await assertPageContains(page, 'Online', 'Backend station must connect to the live validation backend.');
  await page.getByTestId('manager-walkthrough-run-leader-group-assignment').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="manager-walkthrough-run-leader-group-assignment"]');
    return button && !button.disabled;
  }, null, { timeout: 5000 });
  await page.getByTestId('manager-walkthrough-run-leader-group-assignment').click();
  const walkthroughRunSnapshot = await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.id === 'p_manager_demo_001' || item.id === 'P_MANAGER_DEMO_001');
      const run = project?.managerActionRunLedger?.find((item) => item.requirementId === 'leader-group-assignment');
      return Boolean(
        run
        && ((run.resultMessageIds || []).length > 0 || run.resultMessageCount > 0)
        && (run.timelineLogIds || []).length > 0
        && (run.resultTaskId || run.resultCycleId || run.logId)
      );
    },
    'Manager walkthrough run must persist a delegated Action Queue run receipt with message, timeline, and task/cycle proof.',
    { timeoutMs: 15000 },
  );
  const walkthroughRunProject = walkthroughRunSnapshot.projects.find((item) => item.id === 'p_manager_demo_001' || item.id === 'P_MANAGER_DEMO_001');
  const walkthroughRun = walkthroughRunProject?.managerActionRunLedger?.find((item) => item.requirementId === 'leader-group-assignment');
  assert((walkthroughRun.resultMessageIds || []).length > 0 || walkthroughRun.resultMessageCount > 0, 'Manager walkthrough run receipt must summarize generated messages.');
  assert((walkthroughRun.timelineLogIds || []).length > 0, 'Manager walkthrough run receipt must summarize timeline proof.');
  assert(walkthroughRun.resultTaskId || walkthroughRun.resultCycleId || walkthroughRun.logId, 'Manager walkthrough run receipt must carry task, cycle, or action-run proof.');
  await page.waitForFunction(() => {
    const text = document.body.innerText.toLowerCase();
    return text.includes('walkthrough step ran:')
      || text.includes('walkthrough step failed')
      || text.includes('manager action failed');
  }, null, { timeout: 20000 });
  await page.getByTestId('manager-action-run-output').waitFor({ state: 'visible', timeout: 15000 });
  const managerActionOutputText = await page.getByTestId('manager-action-run-output').innerText();
  assert(/Manager Action Output Nodes/i.test(managerActionOutputText), 'Manager Action Queue runs must render backend output nodes, not just ledger receipts.');
  assert(/Result Messages|Task Node|Agent Submission|Evidence Search|Scheduler Tick/i.test(managerActionOutputText), 'Manager Action output nodes must expose delegated chat/task/scheduler/product output.');
  assert(/Output chat proof/i.test(managerActionOutputText), 'Manager Action output nodes must expose chat proof exits.');
  const walkthroughRunBody = await page.locator('body').innerText();
  const normalizedWalkthroughBody = walkthroughRunBody.toLowerCase();
  assert(
    normalizedWalkthroughBody.includes('walkthrough step ran: group @assignment')
      || normalizedWalkthroughBody.includes('manager-scenario-walkthrough/leader-group-assignment/run'),
    `Manager walkthrough run button must execute the backend walkthrough step endpoint. Current status: ${walkthroughRunBody.match(/walkthrough step [^\n]+|manager action failed[^\n]*/i)?.[0] || 'not reported'}`,
  );
  await scrollDashboard(page);
  await page.getByTestId('backend-sync-ready-package').click();
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return /Ready package sync:\s*(?!not synced).*\/\s*[1-9]\d*\s+pulls/i.test(text)
      || text.includes('Backend manager ready package sync failed');
  }, null, { timeout: 15000 });
  const readyPackageSyncBody = await page.locator('body').innerText();
  assert(!readyPackageSyncBody.includes('Backend manager ready package sync failed'), 'Manager ready package sync must complete through the backend.');
  await assertPageContains(page, 'Ready package sync:', 'Manager ready package sync must expose sync status.');
  await page.getByTestId('backend-manager-ready-package-snapshot').waitFor({ state: 'visible', timeout: 15000 });
  await assertPageContains(page, 'Manager Ready Package', 'Backend Worker Station must render the manager ready package snapshot.');
  await assertPageContains(page, 'Gateway Live', 'Manager ready package snapshot must expose adapter gateway live readiness.');
  await assertPageContains(page, 'Gateway State', 'Manager ready package snapshot must expose adapter gateway state readiness.');
  await assertPageContains(page, '/adapter-gateway-preflight', 'Manager ready package snapshot must expose the adapter gateway preflight route.');
  await page.getByTestId('backend-product-team-operating-loop-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  const operatingLoopSourceText = await page.getByTestId('backend-product-team-operating-loop-source').textContent();
  assert(/backend-backed/i.test(operatingLoopSourceText || ''), `Product Team Operating Loop source label must show backend-backed for real backend projects. Current label: ${operatingLoopSourceText || 'missing'}`);
  await assertPageContains(page, 'Product Team Operating Loop', 'Manager ready package snapshot must include the C/A operating loop.');
  await assertPageContains(page, 'Manager Next', 'Product Team Operating Loop snapshot must expose the next C-side action.');
  await assertPageContains(page, 'Agent Strategy', 'Product Team Operating Loop snapshot must expose A-side Agent strategy selection.');
  await assertPageContains(page, 'Agent Initiative', 'Product Team Operating Loop snapshot must expose A-side Agent initiative rows.');
  await page.getByTestId('backend-product-team-operating-loop-initiatives').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Prod Blockers', 'Product Team Operating Loop snapshot must expose production autonomy blockers.');
  await assertPageContains(page, 'Operating loop route:', 'Product Team Operating Loop snapshot must expose the standalone route.');
  await assertPageContains(page, '/product-team-operating-loop', 'Product Team Operating Loop snapshot must point to the standalone endpoint.');
  await page.getByRole('button', { name: /Open Flow Graph/i }).click();
  await page.getByTestId('manager-flow-graph').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByRole('button', { name: /Sync Graph/i }).click();
  const operatingLoopFlowNode = page.getByTestId('manager-flow-node-product-team-operating-loop');
  await operatingLoopFlowNode.waitFor({ state: 'attached', timeout: 15000 });
  const operatingLoopNodeText = await operatingLoopFlowNode.evaluate((element) => element.textContent || '');
  assert(/product-team-operat|C-side|A-side/i.test(operatingLoopNodeText), 'Manager Flow Graph must render the Product Team Operating Loop aggregate node.');
  await page.evaluate(() => {
    const element = document.querySelector('[data-testid="manager-flow-node-product-team-operating-loop"]');
    element?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  });
  await page.waitForFunction(() => {
    const metadata = document.querySelector('[data-testid="timeline-node-metadata-detail"]')?.textContent || '';
    return metadata.includes('product-team-operating-loop');
  }, null, { timeout: 10000 });
  await page.getByTestId('manager-flow-detail-attachment-operating-loop-c-side').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('manager-flow-detail-attachment-operating-loop-a-side').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('manager-flow-detail-attachment-operating-loop-proof').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('manager-flow-detail-attachment-operating-loop-gate').waitFor({ state: 'visible', timeout: 5000 });
  const collaborationIntentFlowNode = page.getByTestId('manager-flow-node-collaboration-intent-queue');
  await collaborationIntentFlowNode.waitFor({ state: 'attached', timeout: 10000 });
  const collaborationIntentNodeText = await collaborationIntentFlowNode.evaluate((element) => element.textContent || '');
  assert(/collaboration intent queue|intent/i.test(collaborationIntentNodeText), 'Manager Flow Graph must render the Collaboration Intent Queue aggregate node.');
  await page.evaluate(() => {
    const element = document.querySelector('[data-testid="manager-flow-node-collaboration-intent-queue"]');
    element?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  });
  await page.waitForFunction(() => {
    const metadata = document.querySelector('[data-testid="timeline-node-metadata-detail"]')?.textContent || '';
    return metadata.includes('collaboration-intent-queue');
  }, null, { timeout: 10000 });
  await page.getByTestId('manager-flow-detail-attachment-collaboration-intent-protocol').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('manager-flow-detail-attachment-agent-autonomous-initiative').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('manager-flow-detail-attachment-collaboration-intent-production-boundary').waitFor({ state: 'visible', timeout: 5000 });
  await backToDashboard(page);
  await page.getByTestId('backend-project-evidence-archive-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Project Evidence Archive', 'Manager ready package snapshot must include the project evidence archive.');
  await assertPageContains(page, 'Archive route:', 'Project evidence archive snapshot must expose the standalone route.');
  await assertPageContains(page, '/project-evidence-archive', 'Project evidence archive snapshot must point to the standalone endpoint.');
  await page.getByTestId('backend-brainstorm-layer-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Brainstorm Layer', 'Manager ready package snapshot must include the brainstorm layer.');
  await assertPageContains(page, 'Brainstorm route:', 'Brainstorm layer snapshot must expose the standalone route.');
  await assertPageContains(page, '/brainstorm-layer', 'Brainstorm layer snapshot must point to the standalone endpoint.');
  await page.getByTestId('backend-artifact-quality-audit-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Artifact Quality Audit', 'Manager ready package snapshot must include the artifact quality audit.');
  await assertPageContains(page, 'Artifact Ready', 'Artifact quality audit snapshot must expose artifact readiness.');
  await assertPageContains(page, 'Audit route:', 'Artifact quality audit snapshot must expose the standalone route.');
  await assertPageContains(page, '/artifact-quality-audit', 'Artifact quality audit snapshot must point to the standalone endpoint.');
  await page.getByTestId('backend-submission-review-workflow-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Submission Review Workflow', 'Manager ready package snapshot must include the submission review workflow.');
  await assertPageContains(page, 'Review Rounds', 'Submission review workflow snapshot must expose review rounds.');
  await assertPageContains(page, 'Review workflow route:', 'Submission review workflow snapshot must expose the standalone route.');
  await assertPageContains(page, '/submission-review-workflow', 'Submission review workflow snapshot must point to the standalone endpoint.');
  await page.getByTestId('backend-provider-controlled-run-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Provider Controlled Run', 'Manager ready package snapshot must include the provider controlled run plan.');
  await assertPageContains(page, 'Run Ready', 'Provider controlled run snapshot must expose run readiness.');
  await assertPageContains(page, 'Controlled run route:', 'Provider controlled run snapshot must expose the standalone route.');
  await assertPageContains(page, '/provider-controlled-run', 'Provider controlled run snapshot must point to the standalone endpoint.');
  await page.getByTestId('backend-provider-eval-run-workflow-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Provider Eval Runs', 'Manager ready package snapshot must include the provider eval run workflow.');
  await assertPageContains(page, 'Eval Ready', 'Provider eval run snapshot must expose eval readiness.');
  await assertPageContains(page, 'Provider eval route:', 'Provider eval run snapshot must expose the standalone route.');
  await assertPageContains(page, '/provider-eval-runs', 'Provider eval run snapshot must point to the standalone endpoint.');
  await page.getByTestId('backend-provider-eval-record-shadow-replay').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('backend-evidence-quality-audit-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Evidence Quality Audit', 'Manager ready package snapshot must include the evidence quality audit.');
  await assertPageContains(page, 'Decision Gates', 'Evidence quality audit snapshot must expose decision gate coverage.');
  await assertPageContains(page, 'Audit route:', 'Evidence quality audit snapshot must expose the standalone route.');
  await assertPageContains(page, '/evidence-quality-audit', 'Evidence quality audit snapshot must point to the standalone endpoint.');
  await page.getByTestId('backend-evidence-source-review-workflow-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Evidence Source Review Workflow', 'Manager ready package snapshot must include the evidence source review workflow.');
  await assertPageContains(page, 'Decisions', 'Evidence source review workflow snapshot must expose source review decision counts.');
  await assertPageContains(page, 'Source review route:', 'Evidence source review workflow snapshot must expose the standalone route.');
  await assertPageContains(page, '/evidence-source-review-workflow', 'Evidence source review workflow snapshot must point to the standalone endpoint.');
  await page.getByTestId('backend-evidence-custody-readiness-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Evidence Custody Readiness', 'Manager ready package snapshot must include evidence custody readiness.');
  await assertPageContains(page, 'Custody route:', 'Evidence custody readiness snapshot must expose the standalone route.');
  await assertPageContains(page, '/evidence-custody-readiness', 'Evidence custody readiness snapshot must point to the standalone endpoint.');
  for (const [testId, label] of [
    ['backend-brainstorm-layer-source', 'Brainstorm Layer'],
    ['backend-artifact-quality-audit-source', 'Artifact Quality Audit'],
    ['backend-submission-review-workflow-source', 'Submission Review Workflow'],
    ['backend-evidence-quality-audit-source', 'Evidence Quality Audit'],
    ['backend-evidence-source-review-workflow-source', 'Evidence Source Review Workflow'],
    ['backend-evidence-custody-readiness-source', 'Evidence Custody Readiness'],
  ]) {
    const sourceText = await page.getByTestId(testId).textContent();
    assert(/backend-backed/i.test(sourceText || ''), `${label} source label must show backend-backed for real backend projects. Current label: ${sourceText || 'missing'}`);
  }
  await page.getByTestId('backend-project-evidence-export-workflow-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Project Evidence Export Workflow', 'Manager ready package snapshot must include the evidence export workflow.');
  await assertPageContains(page, 'Package Gates', 'Project evidence export workflow snapshot must expose local package readiness gates.');
  await page.getByTestId('backend-project-evidence-export-request').waitFor({ state: 'attached', timeout: 5000 });
  assert(await page.getByTestId('backend-project-evidence-export-request').isDisabled(), 'Incomplete real backend projects must keep the evidence export request button disabled until backend gates pass.');
  await page.getByTestId('backend-project-evidence-export-record-download-audit').waitFor({ state: 'attached', timeout: 5000 });
  assert(await page.getByTestId('backend-project-evidence-export-record-download-audit').isDisabled(), 'Incomplete real backend projects must keep the evidence export download-audit button disabled until handoff gates pass.');
  await assertPageContains(page, 'Export route:', 'Project evidence export workflow snapshot must expose the standalone route.');
  await assertPageContains(page, '/project-evidence-exports', 'Project evidence export workflow snapshot must point to the standalone endpoint.');
  await page.getByTestId('backend-private-pilot-go-live-readiness-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Private Pilot Go-Live Readiness', 'Manager ready package snapshot must include private-pilot go-live readiness.');
  await assertPageContains(page, 'Next Action', 'Private-pilot go-live readiness snapshot must expose the next action.');
  await assertPageContains(page, 'Go-live route:', 'Private-pilot go-live readiness snapshot must expose the standalone route.');
  await assertPageContains(page, '/private-pilot-go-live-readiness', 'Private-pilot go-live readiness snapshot must point to the standalone endpoint.');
  await page.getByTestId('backend-production-infrastructure-rehearsal-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Production Infrastructure Rehearsal', 'Manager ready package snapshot must include production infrastructure rehearsal.');
  await assertPageContains(page, 'Production Blocked', 'Production infrastructure rehearsal snapshot must expose production blocker counts.');
  await assertPageContains(page, 'Infrastructure rehearsal route:', 'Production infrastructure rehearsal snapshot must expose the standalone route.');
  await assertPageContains(page, '/production-infrastructure-rehearsal', 'Production infrastructure rehearsal snapshot must point to the standalone endpoint.');
  await page.getByTestId('backend-production-launch-gap-register-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Production Launch Gap Register', 'Manager ready package snapshot must include the production launch gap register.');
  await assertPageContains(page, 'Open Gaps', 'Production launch gap register snapshot must expose open gap counts.');
  await assertPageContains(page, 'Gap register route:', 'Production launch gap register snapshot must expose the standalone route.');
  await assertPageContains(page, '/production-launch-gap-register', 'Production launch gap register snapshot must point to the standalone endpoint.');
  await page.getByTestId('backend-production-launch-control-center-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Production Launch Control Center', 'Manager ready package snapshot must include the production launch control center.');
  await assertPageContains(page, 'Controls', 'Production launch control center snapshot must expose control counts.');
  await assertPageContains(page, 'Control center route:', 'Production launch control center snapshot must expose the standalone route.');
  await assertPageContains(page, '/production-launch-control-center', 'Production launch control center snapshot must point to the standalone endpoint.');
  await page.getByTestId('backend-production-launch-evidence-dossier-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Production Launch Evidence Dossier', 'Manager ready package snapshot must include the production launch evidence dossier.');
  await assertPageContains(page, 'Manifest', 'Production launch evidence dossier snapshot must expose manifest counts.');
  await assertPageContains(page, 'Dossier route:', 'Production launch evidence dossier snapshot must expose the standalone route.');
  await assertPageContains(page, '/production-launch-evidence-dossier', 'Production launch evidence dossier snapshot must point to the standalone endpoint.');
  await page.getByTestId('backend-production-evidence-integrity-audit-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Production Evidence Integrity Audit', 'Manager ready package snapshot must include production evidence integrity audit.');
  await assertPageContains(page, 'Managed Proof', 'Production evidence integrity audit snapshot must expose managed production proof counts.');
  await assertPageContains(page, 'Evidence integrity route:', 'Production evidence integrity audit snapshot must expose the standalone route.');
  await assertPageContains(page, '/production-evidence-integrity-audit', 'Production evidence integrity audit snapshot must point to the standalone endpoint.');
  await page.getByTestId('backend-private-pilot-release-candidate-workflow-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Private Pilot Release Candidate', 'Manager ready package snapshot must include private-pilot release candidate readiness.');
  await assertPageContains(page, 'Candidate Ready', 'Private-pilot release candidate snapshot must expose candidate readiness.');
  await page.getByTestId('backend-private-pilot-record-release-candidate').waitFor({ state: 'attached', timeout: 5000 });
  assert(await page.getByTestId('backend-private-pilot-record-release-candidate').isDisabled(), 'Incomplete real backend projects must keep the release-candidate receipt button disabled until backend gates pass.');
  await assertPageContains(page, 'Candidate route:', 'Private-pilot release candidate snapshot must expose the standalone route.');
  await assertPageContains(page, '/private-pilot-release-candidates', 'Private-pilot release candidate snapshot must point to the standalone endpoint.');
  await page.getByTestId('backend-private-pilot-launch-run-workflow-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Private Pilot Launch Run', 'Manager ready package snapshot must include private-pilot launch run readiness.');
  await assertPageContains(page, 'Launch Ready', 'Private-pilot launch run snapshot must expose launch readiness.');
  await page.getByTestId('backend-private-pilot-record-launch-run').waitFor({ state: 'attached', timeout: 5000 });
  assert(await page.getByTestId('backend-private-pilot-record-launch-run').isDisabled(), 'Incomplete real backend projects must keep the launch-run receipt button disabled until backend gates pass.');
  await assertPageContains(page, 'Launch run route:', 'Private-pilot launch run snapshot must expose the standalone route.');
  await assertPageContains(page, '/private-pilot-launch-runs', 'Private-pilot launch run snapshot must point to the standalone endpoint.');
  await page.getByTestId('backend-private-pilot-launch-health-check-workflow-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Private Pilot Launch Health', 'Manager ready package snapshot must include private-pilot launch health readiness.');
  await assertPageContains(page, 'Health Ready', 'Private-pilot launch health snapshot must expose health readiness.');
  await page.getByTestId('backend-private-pilot-record-launch-health').waitFor({ state: 'attached', timeout: 5000 });
  assert(await page.getByTestId('backend-private-pilot-record-launch-health').isDisabled(), 'Incomplete real backend projects must keep the launch-health receipt button disabled until backend gates pass.');
  await assertPageContains(page, 'Health route:', 'Private-pilot launch health snapshot must expose the standalone route.');
  await assertPageContains(page, '/private-pilot-launch-health-checks', 'Private-pilot launch health snapshot must point to the standalone endpoint.');
  await page.getByTestId('backend-private-pilot-acceptance-report-workflow-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Private Pilot Acceptance Report', 'Manager ready package snapshot must include private-pilot acceptance report readiness.');
  await assertPageContains(page, 'Acceptance Ready', 'Private-pilot acceptance report snapshot must expose acceptance readiness.');
  await page.getByTestId('backend-private-pilot-record-acceptance-report').waitFor({ state: 'attached', timeout: 5000 });
  assert(await page.getByTestId('backend-private-pilot-record-acceptance-report').isDisabled(), 'Incomplete real backend projects must keep the acceptance-report receipt button disabled until backend gates pass.');
  await assertPageContains(page, 'Acceptance route:', 'Private-pilot acceptance report snapshot must expose the standalone route.');
  await assertPageContains(page, '/private-pilot-acceptance-reports', 'Private-pilot acceptance report snapshot must point to the standalone endpoint.');
  await page.getByTestId('backend-production-operations-readiness-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Production Operations Readiness', 'Manager ready package snapshot must include production operations readiness.');
  await assertPageContains(page, 'Prod Controls', 'Production operations snapshot must expose production control gates.');
  await assertPageContains(page, 'Production ops route:', 'Production operations snapshot must expose the standalone route.');
  await assertPageContains(page, '/production-operations-readiness', 'Production operations snapshot must point to the standalone endpoint.');
  await page.getByTestId('backend-production-operations-control-receipts-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Production Operations Control Receipts', 'Manager ready package snapshot must include production operations control receipts.');
  await assertPageContains(page, 'Verified Controls', 'Production operations control receipt snapshot must expose verified controls.');
  await assertPageContains(page, 'Ops receipts route:', 'Production operations control receipt snapshot must expose the standalone route.');
  await assertPageContains(page, '/production-operations-control-receipts', 'Production operations control receipt snapshot must point to the standalone endpoint.');
  await page.getByTestId('backend-production-operations-record-controls').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('backend-production-deployment-control-receipts-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Production Deployment Control Receipts', 'Manager ready package snapshot must include production deployment control receipts.');
  await assertPageContains(page, 'Verified Controls', 'Production deployment control receipt snapshot must expose verified controls.');
  await assertPageContains(page, 'Deployment receipts route:', 'Production deployment control receipt snapshot must expose the standalone route.');
  await assertPageContains(page, '/production-deployment-control-receipts', 'Production deployment control receipt snapshot must point to the standalone endpoint.');
  await page.getByTestId('backend-production-deployment-record-controls').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('backend-production-security-control-receipts-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Production Security Control Receipts', 'Manager ready package snapshot must include production security control receipts.');
  await assertPageContains(page, 'Verified Controls', 'Production security control receipt snapshot must expose verified controls.');
  await assertPageContains(page, 'Security receipts route:', 'Production security control receipt snapshot must expose the standalone route.');
  await assertPageContains(page, '/production-security-control-receipts', 'Production security control receipt snapshot must point to the standalone endpoint.');
  await page.getByTestId('backend-production-security-record-controls').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('backend-production-provider-control-receipts-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Production Provider Control Receipts', 'Manager ready package snapshot must include production provider control receipts.');
  await assertPageContains(page, 'Provider Eval', 'Production provider control receipt snapshot must expose provider eval readiness.');
  await assertPageContains(page, 'Provider receipts route:', 'Production provider control receipt snapshot must expose the standalone route.');
  await assertPageContains(page, '/production-provider-control-receipts', 'Production provider control receipt snapshot must point to the standalone endpoint.');
  await page.getByTestId('backend-production-provider-record-controls').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('backend-production-launch-audit-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Production Launch Audit', 'Manager ready package snapshot must include production launch audit.');
  await assertPageContains(page, 'Handoff Package', 'Production launch audit snapshot must expose evidence handoff package status.');
  await assertPageContains(page, 'Audit route:', 'Production launch audit snapshot must expose the standalone route.');
  await assertPageContains(page, '/production-launch-audit', 'Production launch audit snapshot must point to the standalone endpoint.');
  await page.getByTestId('backend-launch-approval-workflow-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Launch Approval Workflow', 'Manager ready package snapshot must include launch approval workflow.');
  await page.getByTestId('backend-launch-approval-record-manager').waitFor({ state: 'attached', timeout: 5000 });
  assert(!(await page.getByTestId('backend-launch-approval-record-manager').isDisabled()), 'Incomplete real backend projects with a route-backed launch approval workflow must let the Manager record the missing private-pilot approval role.');
  await page.getByTestId('backend-launch-approval-record-security').waitFor({ state: 'attached', timeout: 5000 });
  assert(!(await page.getByTestId('backend-launch-approval-record-security').isDisabled()), 'Incomplete real backend projects with a route-backed launch approval workflow must let security record the missing private-pilot approval role.');
  await assertPageContains(page, 'Approval route:', 'Launch approval workflow snapshot must expose the standalone route.');
  await assertPageContains(page, '/launch-approvals', 'Launch approval workflow snapshot must point to the standalone endpoint.');
  await assertPageContains(page, 'Trail Ready', 'Manager ready package snapshot must include scenario trail summary.');
  await assertPageContains(page, 'Walkthrough', 'Manager ready package snapshot must include scenario walkthrough summary.');
  await assertPageContains(page, 'Requirements', 'Manager ready package snapshot must include requirement coverage summary.');
  await assertPageContains(page, 'Kickoff Board', 'Manager ready package snapshot must include kickoff board coverage.');
  await assertPageContains(page, 'Work Loop Board', 'Manager ready package snapshot must include 24/7 work-loop board coverage.');
  await assertPageContains(page, 'Collaboration Board', 'Manager ready package snapshot must include collaboration board coverage.');
  await assertPageContains(page, 'Change Protocol', 'Manager ready package snapshot must include change protocol coverage.');
  await assertPageContains(page, 'Change Owners', 'Manager ready package snapshot must include change owner sync coverage.');
  await page.getByTestId('backend-sync-command-center').click();
  await assertPageContains(page, 'Command center sync:', 'Standalone command center sync must expose sync status.');
  await page.getByTestId('backend-manager-command-center-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Manager Command Center', 'Backend manager snapshot must include standalone command center counts.');
  await assertPageContains(page, '/manager-command-center', 'Standalone command center snapshot must show its endpoint route.');
  await page.getByTestId('backend-sync-scenario-walkthrough').click();
  await assertPageContains(page, 'Scenario walkthrough sync:', 'Standalone scenario walkthrough sync must expose sync status.');
  await page.getByTestId('backend-manager-scenario-walkthrough-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Manager Scenario Walkthrough', 'Backend manager snapshot must include standalone scenario walkthrough counts.');
  await assertPageContains(page, '/manager-scenario-walkthrough', 'Standalone scenario walkthrough snapshot must show its endpoint route.');
  await page.getByTestId('backend-sync-scenario-trail').click();
  await assertPageContains(page, 'Scenario trail sync:', 'Standalone scenario trail sync must expose sync status.');
  await page.getByTestId('backend-manager-scenario-trail-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Standalone Trail', 'Backend manager snapshot must include standalone scenario trail counts.');
  await assertPageContains(page, 'Walkthrough route:', 'Backend manager snapshot must include the standalone walkthrough route.');
  await page.getByTestId('backend-sync-requirement-matrix').click();
  await assertPageContains(page, 'Requirement matrix sync:', 'Standalone requirement matrix sync must expose sync status.');
  await page.getByTestId('backend-manager-requirement-matrix-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Manager Requirement Matrix', 'Backend manager snapshot must include standalone requirement matrix counts.');
  await assertPageContains(page, 'Ready Rows', 'Standalone requirement matrix snapshot must show ready row coverage.');
  await page.getByTestId('backend-sync-sync-protocol-audit').click();
  await assertPageContains(page, 'Sync protocol audit sync:', 'Standalone sync protocol audit sync must expose sync status.');
  await page.getByTestId('backend-sync-protocol-audit-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Sync Protocol Audit', 'Backend manager snapshot must include standalone sync protocol audit counts.');
  await assertPageContains(page, '/sync-protocol-audit', 'Standalone sync protocol audit snapshot must show its endpoint route.');
  await page.getByTestId('backend-sync-use-case-audit').click();
  await assertPageContains(page, 'Use case audit sync:', 'Standalone use case audit sync must expose sync status.');
  await page.getByTestId('backend-manager-use-case-audit-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Use case route:', 'Standalone use case audit snapshot must show its endpoint route.');
  await assertPageContains(page, 'Latest stage:', 'Standalone use case audit snapshot must show its latest stage.');
  await page.getByTestId('backend-sync-action-queue').click();
  await assertPageContains(page, 'Action queue sync:', 'Standalone action queue sync must expose sync status.');
  await page.getByTestId('backend-manager-action-queue-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Manager Action Queue', 'Backend manager snapshot must include standalone action queue counts.');
  await assertPageContains(page, 'Next Action', 'Standalone action queue snapshot must show the next manager action.');
  await page.getByTestId('backend-sync-agent-autonomous-action-queue').click();
  await assertPageContains(page, 'Agent autonomous queue sync:', 'Standalone Agent autonomous action queue sync must expose sync status.');
  await assertPageContains(page, 'Autonomous run control sync:', 'Autonomous run control sync must expose sync status.');
  await page.getByTestId('backend-autonomous-run-control-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Autonomous Run Control', 'Backend manager snapshot must include the autonomous run control.');
  await assertPageContains(page, '/autonomous-run-control', 'Autonomous run control snapshot must show its backend route.');
  const autonomousRunControlButton = page.locator('button[data-testid^="backend-autonomous-run-control-action-run-"]:not([disabled])').first();
  await autonomousRunControlButton.waitFor({ state: 'visible', timeout: 5000 });
  await autonomousRunControlButton.click();
  await page.getByTestId('backend-autonomous-run-control-run-receipt').waitFor({ state: 'visible', timeout: 12000 });
  await assertPageContains(page, 'Run receipt:', 'Running an autonomous control action must render a backend run receipt.');
  await page.getByTestId('backend-autonomous-run-control-run-output').waitFor({ state: 'visible', timeout: 15000 });
  const runControlOutputText = await page.getByTestId('backend-autonomous-run-control-run-output').innerText();
  assert(/Run Control Output Nodes/i.test(runControlOutputText), 'Running an autonomous control action must render backend output nodes, not just a run receipt.');
  assert(/Agent Submission|Evidence Search|Submission Review|Review Response|Result Messages|Artifact/i.test(runControlOutputText), 'Autonomous Run Control output must expose the delegated product node or transcript result.');
  assert(/Output chat proof/i.test(runControlOutputText), 'Autonomous Run Control output nodes must expose chat proof exits.');
  await page.getByTestId('backend-run-control-action-decision').waitFor({ state: 'visible', timeout: 10000 });
  const runControlDecisionText = await page.getByTestId('backend-run-control-action-decision').innerText();
  assert(/Action Decision/i.test(runControlDecisionText) && /Strategy/i.test(runControlDecisionText), 'Autonomous Run Control output must render the backend Agent action decision.');
  await page.getByTestId('backend-sync-agent-autonomous-action-queue').click();
  await assertPageContains(page, 'Agent autonomous queue sync:', 'Agent autonomous queue must refresh after an autonomous control action.');
  await page.getByTestId('backend-agent-autonomous-action-queue-snapshot').waitFor({ state: 'visible', timeout: 15000 });
  await assertPageContains(page, 'Agent Autonomous Queue', 'Backend manager snapshot must include the Agent autonomous action queue.');
  await assertPageContains(page, '/agent-autonomous-action-queue', 'Agent autonomous action queue snapshot must show its backend route.');
  const agentAutonomousRunButton = page.locator('button[data-testid^="backend-agent-autonomous-action-run-"]:not([disabled])').first();
  await agentAutonomousRunButton.waitFor({ state: 'visible', timeout: 15000 });
  await agentAutonomousRunButton.click();
  await page.getByTestId('backend-agent-autonomous-action-run-receipt').waitFor({ state: 'visible', timeout: 12000 });
  await assertPageContains(page, 'Run receipt:', 'Running an Agent autonomous queue row must render a backend run receipt.');
  await page.getByTestId('backend-agent-autonomous-action-run-output').waitFor({ state: 'visible', timeout: 15000 });
  await page.getByTestId('backend-agent-autonomous-action-run-output-rows').waitFor({ state: 'visible', timeout: 15000 });
  const agentActionOutputText = await page.getByTestId('backend-agent-autonomous-action-run-output').innerText();
  assert(/Agent Action Output Nodes/i.test(agentActionOutputText) && /Agent Submission|Evidence Search|Submission Review|Review Response|Result Messages/i.test(agentActionOutputText), 'Running an Agent autonomous queue row must render delegated Agent output nodes.');
  assert(/Output chat proof/i.test(agentActionOutputText), 'Agent autonomous output nodes must expose chat proof exits.');
  await page.getByTestId('backend-agent-autonomous-action-decision').waitFor({ state: 'visible', timeout: 10000 });
  const agentActionDecisionText = await page.getByTestId('backend-agent-autonomous-action-decision').innerText();
  assert(/Action Decision/i.test(agentActionDecisionText) && /Strategy/i.test(agentActionDecisionText), 'Agent autonomous output must render the backend Agent action decision.');
  await page.getByTestId('backend-sync-collaboration-intent-queue').click();
  await assertPageContains(page, 'Collaboration intent queue sync:', 'Standalone collaboration intent queue sync must expose sync status.');
  await page.getByTestId('backend-collaboration-intent-queue-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Collaboration Intent Queue', 'Backend manager snapshot must include the Collaboration Intent Queue.');
  await assertPageContains(page, '/collaboration-intent-queue', 'Collaboration intent queue snapshot must show its backend route.');
  await assertPageContains(page, 'Intent chat proof', 'Collaboration intent queue rows must expose transcript proof actions.');
  await assertPageContains(page, 'Intent timeline proof', 'Collaboration intent queue rows must expose timeline proof actions.');
  await page.getByTestId('manager-assignment-composer-input').scrollIntoViewIfNeeded();
  await page.getByTestId('manager-assignment-composer-target').selectOption('turing');
  await page.getByTestId('manager-assignment-composer-input').fill('prepare composer assignment evidence packet');
  await page.getByTestId('manager-assignment-composer-submit').click();
  await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.name === 'Manager Demo: Autonomous Agent Studio');
      const task = project?.tasks?.find((item) => item.source === 'leader-chat-assignment' && /composer assignment evidence packet/i.test(item.text || ''));
      return Boolean(
        task
        && task.ownerId === 'turing'
        && task.assignmentMessageId
        && task.acknowledgementMessageId
        && project.agentStates?.turing?.inbox?.some((item) => item.taskId === task.id)
        && project.agentStates?.turing?.obligations?.some((item) => item.taskId === task.id)
        && project.logs?.some((log) => log.id === `log_${task.assignmentMessageId}` && log.eventType === 'leader-assignment')
        && project.logs?.some((log) => log.id === `log_${task.acknowledgementMessageId}` && log.eventType === 'assignment-acknowledged')
        && project.agentWorkerLedger?.some((record) => record.agentId === 'turing' && record.trigger === 'leader-assignment-start-work' && record.taskId === task.id)
        && snapshot.messages.some((message) => message.projectId === project.id && message.agentWorker?.agentId === 'turing' && message.agentWorker?.trigger === 'leader-assignment-start-work' && message.agentWorker?.taskId === task.id)
        && snapshot.messages.some((message) => message.projectId === project.id && message.id === task.assignmentMessageId && /@Alan Turing/i.test(message.text || ''))
      );
    },
    'Leader assignment composer must persist a custom group @assignment with inbox, obligation, acknowledgement, immediate work pulse, and timeline evidence.',
  );
  await assertPageContains(page, 'composer assignment evidence packet', 'Leader assignment composer must render the custom assignment in the dashboard.');
  await page.getByTestId('manager-change-composer-input').scrollIntoViewIfNeeded();
  await page.getByTestId('manager-change-composer-input').fill('@all add composer-driven forecast packet before manager review');
  await page.getByTestId('manager-change-composer-mode').selectOption('dual');
  await page.getByTestId('manager-change-composer-submit').click();
  await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.name === 'Manager Demo: Autonomous Agent Studio');
      const composerChange = project?.changeLedger?.find((change) => (
        change.source === 'multi-channel-change-request'
        && change.sourceMessageIds?.length === 2
        && /composer-driven forecast packet/i.test(changeLedgerText(change))
      ));
      return Boolean(
        composerChange
        && snapshot.messages.some((message) => message.projectId === project.id && /composer-driven forecast packet/i.test(message.text || ''))
        && project.agentStates?.[composerChange.ownerId]?.currentPlan?.changeRecordId === composerChange.id
        && (composerChange.teamSyncAgentIds || []).length === Math.max(0, (project.team?.length || 1) - 1)
        && project.agentWorkerLedger?.some((record) => record.trigger === 'change-owner-start-work' && record.taskId === composerChange.taskId)
        && snapshot.messages.some((message) => message.projectId === project.id && message.agentWorker?.trigger === 'change-owner-start-work' && message.agentWorker?.taskId === composerChange.taskId)
      );
    },
    'Manager change intake composer must persist a custom dual-channel change with owner plan, team sync, and immediate owner work-pulse evidence.',
    { timeoutMs: 30_000 },
  );
  await assertPageContains(page, 'composer-driven forecast packet', 'Manager change intake composer must render the custom change in the dashboard.');
  await station.getByRole('button', { name: /^Start$/i }).click();
  await assertPageContains(page, 'IMMEDIATE START: YES', 'Backend scheduler start must immediately kick the autonomous worker path.');
  await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => snapshot.projects.some((project) => project.name === 'Manager Demo: Autonomous Agent Studio'),
    'Backend scheduler start must persist the active manager project before running workers.',
  );
  await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.name === 'Manager Demo: Autonomous Agent Studio');
      return Boolean(
        project?.autonomousSchedulerLedger?.some((record) => record.trigger === 'manager-ui-scheduler-start-pulse')
        && snapshot.messages.some((message) => message.projectId === project.id && message.source === 'manager-ui-scheduler-start-chat'),
      );
    },
    'Backend scheduler start must publish a current-project autonomous pulse.',
    { timeoutMs: 10000 },
  );
  await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.name === 'Manager Demo: Autonomous Agent Studio');
      return Boolean(
        project?.agentWorkerLedger?.some((record) => record.trigger === 'http-autonomous-scheduler-startup-agents')
        && snapshot.messages.some((message) => message.projectId === project.id && message.agentWorker?.trigger === 'http-autonomous-scheduler-startup-agents'),
      );
    },
    'Backend scheduler start must immediately run a per-Agent startup sweep.',
    { timeoutMs: 10000 },
  );
  await waitForBackendLastResult(page, station);
  await assertPageContains(page, 'Latest Backend Work', 'Backend scheduler start must surface the latest worker result in the station.');
  await assertPageContains(page, 'HTTP-AUTONOMOUS-SCHEDULER-STARTUP-AGENTS', 'Backend scheduler start must expose the Agent startup sweep trigger.');
  await assertPageContains(page, 'MANAGER-UI-SCHEDULER-START-PULSE', 'Backend scheduler start pulse must be visible on the manager dashboard.');
  await station.getByRole('button', { name: /^Stop$/i }).click();

  await station.getByRole('button', { name: /Server Pulse/i }).click();
  await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.name === 'Manager Demo: Autonomous Agent Studio');
      return Boolean(
        project?.autonomousSchedulerLedger?.some((record) => record.trigger === 'manager-ui-backend-pulse')
        && snapshot.messages.some((message) => message.projectId === project.id && message.source === 'manager-ui-backend-station-chat'),
      );
    },
    'Backend Server Pulse must persist the autonomous pulse before the UI assertion.',
    { timeoutMs: 10000 },
  );
  await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.name === 'Manager Demo: Autonomous Agent Studio');
      return Boolean(
        project?.agentWorkerLedger?.some((record) => record.trigger === 'manager-ui-backend-pulse-agents')
        && snapshot.messages.some((message) => message.projectId === project.id && message.agentWorker?.trigger === 'manager-ui-backend-pulse-agents'),
      );
    },
    'Backend Server Pulse must run a real scheduler tick with Agent worker output.',
    { timeoutMs: 10000 },
  );
  await page.waitForFunction(() => document.body.innerText.includes('MANAGER-UI-BACKEND-PULSE'), null, { timeout: 10000 });
  await assertPageContains(page, 'MANAGER-UI-BACKEND-PULSE', 'Backend Server Pulse must update the manager dashboard.');
  await page.getByRole('button', { name: /Hour Pulse/i }).click();
  await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.name === 'Manager Demo: Autonomous Agent Studio');
      return Boolean(
        project?.autonomousSchedulerLedger?.some((record) => record.trigger === 'manager-ui-hourly-pulse')
        && project.agentWorkerLedger?.some((record) => record.trigger === 'manager-ui-hourly-pulse-agents'),
      );
    },
    'Backend Hour Pulse must run through the scheduler tick route with Agent worker output.',
    { timeoutMs: 10000 },
  );
  await page.waitForFunction(() => document.body.innerText.includes('MANAGER-UI-HOURLY-PULSE'), null, { timeout: 10000 });
  await assertPageContains(page, 'MANAGER-UI-HOURLY-PULSE', 'Backend Hour Pulse must update the manager dashboard through the scheduler tick path.');
  await station.scrollIntoViewIfNeeded();
  const catalogSyncStatus = station.getByTestId('backend-project-catalog-sync-status');
  await catalogSyncStatus.waitFor({ state: 'attached', timeout: 5000 });
  await catalogSyncStatus.scrollIntoViewIfNeeded();
  await catalogSyncStatus.waitFor({ state: 'visible', timeout: 5000 });
  const catalogSyncButton = station.getByTestId('backend-sync-project-catalog-detail');
  await catalogSyncButton.scrollIntoViewIfNeeded();
  await catalogSyncButton.click();
  await page.waitForTimeout(400);
  await assertPageContains(page, 'Project catalog sync:', 'Backend project catalog sync must be a visible station action.');
  const seededCatalogSnapshot = await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => snapshot.projects.some((project) => project.name === 'Manager Demo: Autonomous Agent Studio' && project.sampleFixture?.id === 'manager-demo'),
    'Explicit Seed Sample/Dev must persist the browser snapshot only for sample/dev fallback projects.',
  );
  assert(seededCatalogSnapshot.projects.some((project) => project.sampleFixture?.id === 'manager-demo'), 'Backend catalog must retain Manager Demo sample-fixture provenance after later sync actions.');
  await station.getByRole('button', { name: /Sync State/i }).click();
  await assertPageContains(page, 'Project sync:', 'Backend Sync State must keep project sync evidence visible in the UI.');
  await assertPageContains(page, 'Manager dashboard sync:', 'Backend Sync State must refresh the aggregate manager dashboard snapshot.');
  await page.getByTestId('backend-manager-dashboard-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Backend Manager Snapshot', 'Backend Worker Station must show the aggregate manager-dashboard read model.');
  await assertPageContains(page, 'Proof Routes', 'Backend manager snapshot must show readiness proof route count.');
  await assertPageContains(page, 'Ops Agents', 'Backend manager snapshot must show Agent operations count.');
  await assertPageContains(page, 'Management Checks', 'Backend manager snapshot must show management check evidence.');
  await assertPageContains(page, 'Assignment Rows', 'Backend manager snapshot must show assignment flow count.');
  await assertPageContains(page, 'Change Rows', 'Backend manager snapshot must show change flow count.');
  await station.getByRole('button', { name: /Sync Manager View/i }).click();
  await assertPageContains(page, 'BACKEND MANAGER READY PACKAGE SYNCED', 'Manual manager view sync must update the backend station action through the ready package.');
  await page.getByTestId('backend-manager-ready-package-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('backend-manager-dashboard-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, '24/7 Operations Board', 'Backend-connected dashboard must expose the 24/7 operations board.');
  await assertPageContains(page, 'Project Next Run', '24/7 operations board must show project next run.');
  await assertPageContains(page, 'Project Last Run', '24/7 operations board must show project last run.');
  await assertPageContains(page, 'Backend Worker', '24/7 operations board must show backend worker state.');
  await assertPageContains(page, 'Agent Run Queue', '24/7 operations board must show Agent run queue.');
  await assertPageContains(page, 'Next Agent Run', '24/7 operations board must show per-Agent next run.');
  await assertPageContains(page, 'Latest Agent Work', '24/7 operations board must show per-Agent latest work.');
  await assertPageContains(page, 'Worker Trigger', '24/7 operations board must show per-Agent worker trigger.');
  await assertPageContains(page, 'Management Priority', '24/7 operations board must show per-Agent priority.');
  await page.getByTestId('operations-agent-turing').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Continuous Work Loop', 'Backend-connected dashboard must expose continuous 24/7 work-loop proof.');
  await assertPageContains(page, 'Scheduler State', 'Continuous Work Loop must show scheduler state.');
  await assertPageContains(page, 'Next Project Pulse', 'Continuous Work Loop must show the next project pulse.');
  await assertPageContains(page, 'Agent Loops', 'Continuous Work Loop must show scheduled Agent loops.');
  await assertPageContains(page, 'Timeline Proof', 'Continuous Work Loop must show timeline proof coverage.');
  await page.getByRole('button', { name: /Loop timeline proof/i }).first().click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:', 'Continuous Work Loop timeline proof must jump to exact timeline evidence.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Continuous Rows', 'Backend manager snapshot must include continuous work-loop rows.');
  await assertPageContains(page, 'Continuous Proofs', 'Backend manager snapshot must include continuous proof counts.');

  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Kickoff Meeting Flow', 'Backend-connected dashboard must expose the kickoff meeting flow.');
  await assertPageContains(page, 'Kickoff Brief Alignment', 'Backend-connected dashboard must expose Director brief alignment.');
  await assertPageContains(page, 'Brief Heard By', 'Kickoff brief alignment must show which Agents heard the project brief.');
  await page.getByTestId('kickoff-brief-alignment').getByRole('button', { name: /Brief proof/i }).first().click();
  await assertPageContains(page, 'PROOF FOCUS:', 'Kickoff brief proof must jump to exact group-chat evidence.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Confirmed Team Matrix', 'Kickoff meeting flow must show the Director-confirmed roster matrix.');
  await assertPageContains(page, 'Project State', 'Confirmed Team Matrix must show project-state persistence.');
  await assertPageContains(page, 'Charter', 'Confirmed Team Matrix must show kickoff charter persistence.');
  await page.getByTestId('kickoff-confirmed-team-matrix').getByRole('button', { name: /Team timeline proof/i }).first().click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:', 'Confirmed Team Matrix proof must jump to timeline evidence.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Role Clarification', 'Kickoff meeting flow must show role clarification.');
  await assertPageContains(page, 'Self Nominations', 'Kickoff meeting flow must show self-nominations.');
  await assertPageContains(page, 'Peer Hearing', 'Kickoff meeting flow must show peer hearing proof.');
  await assertPageContains(page, 'Leader Campaign', 'Kickoff meeting flow must show Leader campaign proof.');
  await assertPageContains(page, 'LEADER ELECTION RESOLUTION', 'Kickoff meeting flow must show Leader election resolution proof.');
  await assertPageContains(page, 'Director Confirmation', 'Kickoff meeting flow must show Director confirmation.');
  await assertPageContains(page, 'Leader Marker', 'Kickoff meeting flow must show persisted Leader marker.');
  await assertPageContains(page, 'Kickoff Hearing Matrix', 'Kickoff meeting flow must show the speaker-to-listener hearing matrix.');
  await assertPageContains(page, 'Role Questions Heard', 'Kickoff hearing matrix must include role-question receipt rows.');
  await assertPageContains(page, 'Self Nominations Heard', 'Kickoff hearing matrix must include self-nomination receipt rows.');
  await assertPageContains(page, 'Leader Campaign Hearing', 'Kickoff hearing matrix must include Leader campaign receipt rows.');
  await assertPageContains(page, 'Heard By:', 'Kickoff hearing matrix must name the Agents who heard each turn.');
  await page.getByTestId('kickoff-hearing-matrix').getByRole('button', { name: /Hearing proof/i }).first().click();
  await assertPageContains(page, 'PROOF FOCUS:', 'Kickoff hearing matrix proof must jump to exact chat evidence.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Conversation Evidence', 'Kickoff meeting flow must show concrete conversation evidence rows.');
  await assertPageContains(page, 'ROLE QUESTION ANSWERS', 'Kickoff meeting flow must show answered/waiting role-question rows.');
  await page.getByTestId('kickoff-conversation-flow').getByRole('button', { name: /Conversation proof/i }).first().click();
  await assertPageContains(page, 'PROOF FOCUS:', 'Kickoff conversation row proof must jump to exact chat evidence.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await page.getByRole('button', { name: /Kickoff meeting proof/i }).click();
  await assertPageContains(page, 'PROOF FOCUS:', 'Kickoff meeting proof must jump to exact group-chat evidence.');
  await assertPageContains(page, 'Election', 'Kickoff meeting proof must include Leader election campaign evidence.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Kickoff Execution Flow', 'Backend-connected dashboard must expose kickoff execution flow.');
  await assertPageContains(page, 'Next Actions', 'Kickoff execution flow must show next actions.');
  await assertPageContains(page, 'Leader Assignments', 'Kickoff execution flow must show Leader assignment count.');
  await assertPageContains(page, 'First Pulse', 'Kickoff execution flow must show first autonomous pulse.');
  await assertPageContains(page, '24/7 Work', 'Kickoff execution flow must show autonomous readiness.');
  await assertPageContains(page, 'All-Agent Startup Matrix', 'Kickoff execution flow must expose all-Agent startup coverage.');
  await assertPageContains(page, 'Started', 'All-Agent Startup Matrix must show started status.');
  await assertPageContains(page, 'Queued', 'All-Agent Startup Matrix must show next-run queue status.');
  await assertPageContains(page, 'Routine Plan', 'All-Agent Startup Matrix must show fixed routine plan proof.');
  await assertPageContains(page, 'Startup Proof', 'All-Agent Startup Matrix must show first-pulse or worker startup proof.');
  await page.getByTestId('all-agent-startup-matrix').getByRole('button', { name: /Startup timeline proof/i }).first().click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:', 'All-Agent Startup Matrix proof must jump to timeline evidence.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Startup Agents', 'Backend manager snapshot must include all-Agent startup counts.');
  await page.getByRole('button', { name: /First pulse timeline proof/i }).click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:', 'Kickoff execution flow must jump to first-pulse timeline proof.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Group Chat Transcript Index', 'Backend-connected dashboard must expose group-chat transcript index.');
  await assertPageContains(page, 'Message Count', 'Transcript index must show message counts.');
  await assertPageContains(page, 'Archived Proofs', 'Transcript index must show archived proof recovery counts.');
  await assertPageContains(page, 'Latest Speaker', 'Transcript index must show latest speaker.');
  await assertPageContains(page, 'Receipt Coverage', 'Transcript index must show receipt coverage.');
  await assertPageContains(page, 'Direct Mentions', 'Transcript index must show direct mentions.');
  await page.getByTestId('transcript-channel-main').getByRole('button', { name: /Open transcript/i }).click();
  await assertPageContains(page, 'PROOF FOCUS:', 'Transcript index must open exact chat proof focus.');
  await assertPageContains(page, 'HEARD BY', 'Transcript index chat proof must expose named receipt evidence.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="agent-work-cycle-turing"]');
    return button && !button.disabled;
  }, null, { timeout: 10000 });
  await page.getByTestId('agent-work-cycle-turing').click();
  const turingPulseSnapshot = await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.name === 'Manager Demo: Autonomous Agent Studio');
      return Boolean(
        project?.agentWorkerLedger?.some((record) => record.agentId === 'turing' && record.trigger === 'manager-ui-agent-pulse' && typeof record.managementPriority === 'number' && Array.isArray(record.managementReasons))
        && snapshot.messages.some((message) => message.projectId === project.id && message.agentWorker?.agentId === 'turing'),
      );
    },
    'Backend-connected Agent Pulse must run through the per-Agent worker route.',
  );
  const turingPulseProject = turingPulseSnapshot.projects.find((item) => item.name === 'Manager Demo: Autonomous Agent Studio');
  const turingPulseRecord = turingPulseProject?.agentWorkerLedger?.find((record) => record.agentId === 'turing' && record.trigger === 'manager-ui-agent-pulse');
  const managedResponseTargetId = turingPulseRecord?.managementTargetIds?.[0];
  assert(managedResponseTargetId, 'Backend-connected Agent Pulse must create a managed-Agent target for response validation.');
  const managedResponseTarget = turingPulseProject?.team?.find((member) => member.id === managedResponseTargetId || member.name === managedResponseTargetId);
  const managedResponseTargetButtonId = managedResponseTarget?.id || managedResponseTargetId;
  await page.getByTestId('agent-priority-turing').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('agent-state-detail-turing').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Priority', 'Backend-connected Agent Pulse must expose Agent priority in the Team row.');
  await assertPageContains(page, 'Latest Inbox', 'Backend-connected Agent Pulse must keep independent Agent inbox state visible.');
  await assertPageContains(page, 'Open Obligation', 'Backend-connected Agent Pulse must keep independent Agent obligations visible.');
  await assertPageContains(page, 'Latest Worklog', 'Backend-connected Agent Pulse must keep independent Agent worklog visible.');
  await assertPageContains(page, 'Next Agent Run', 'Backend-connected Agent Pulse must keep independent Agent schedule visible.');
  await page.getByTestId('agent-focus-open-turing').click();
  await page.getByTestId('agent-focus-panel-turing').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Agent Focus Workspace', 'Manager dashboard must open a dedicated per-Agent workspace from the Team row.');
  await assertPageContains(page, 'Owned Task Evidence', 'Per-Agent workspace must expose owned task evidence.');
  await assertPageContains(page, 'Independent state', 'Per-Agent workspace must describe the independent Agent state surface.');
  await page.getByTestId('agent-focus-backend-dashboard-turing').waitFor({ state: 'visible', timeout: 15000 });
  await page.getByTestId('agent-focus-backend-cadence-turing').waitFor({ state: 'visible', timeout: 15000 });
  const agentDashboardSource = (await page.getByTestId('agent-focus-dashboard-source-turing').textContent()) || '';
  assert(agentDashboardSource.includes('backend-backed'), 'Per-Agent workspace must label the synced Agent Dashboard as backend-backed.');
  await assertPageContains(page, 'Backend Agent Dashboard', 'Per-Agent workspace must sync the backend Agent dashboard read model.');
  await assertPageContains(page, '/agents/turing/dashboard', 'Per-Agent workspace must expose the backend Agent dashboard route.');
  await assertPageContains(page, 'Run Agent Pulse', 'Per-Agent workspace must expose a direct backend Agent pulse control.');
  await assertPageContains(page, 'Management Priority', 'Per-Agent workspace must expose backend management priority evidence.');
  await assertPageContains(page, 'Next Run', 'Per-Agent workspace must expose backend cadence evidence.');
  await assertPageContains(page, 'Routine', 'Per-Agent workspace must expose fixed routine evidence.');
  await assertPageContains(page, 'Control Runs', 'Per-Agent workspace must expose backend autonomous control run evidence.');
  await assertPageContains(page, 'Management Surface', 'Per-Agent workspace must expose leader-chain and peer-management evidence.');
  await assertPageContains(page, 'Managed By', 'Per-Agent workspace must show who manages the focused Agent.');
  await assertPageContains(page, 'Manages', 'Per-Agent workspace must show which Agents the focused Agent manages.');
  await assertPageContains(page, 'Peer Management', 'Per-Agent workspace must show peer-management counts.');
  await page.getByTestId('agent-focus-management-proof-turing').click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:', 'Per-Agent management proof must jump to timeline evidence.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  const focusPulseSnapshotBefore = await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => snapshot.projects.find((item) => item.name === 'Manager Demo: Autonomous Agent Studio'),
    'Backend snapshot must include the project before running the Agent Focus pulse.',
  );
  const focusPulseProjectBefore = focusPulseSnapshotBefore.projects.find((item) => item.name === 'Manager Demo: Autonomous Agent Studio');
  const focusPulseCountBefore = focusPulseProjectBefore?.agentWorkerLedger?.filter((record) => record.agentId === 'turing' && record.trigger === 'manager-ui-agent-pulse').length || 0;
  await page.getByTestId('agent-focus-pulse-turing').click();
  await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.name === 'Manager Demo: Autonomous Agent Studio');
      const focusPulseCountAfter = project?.agentWorkerLedger?.filter((record) => record.agentId === 'turing' && record.trigger === 'manager-ui-agent-pulse').length || 0;
      return focusPulseCountAfter > focusPulseCountBefore;
    },
    'Agent Focus Run Agent Pulse must dispatch through the backend per-Agent worker route.',
  );
  await page.getByTestId('agent-focus-backend-dashboard-turing').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForFunction((targetId) => {
    const button = document.querySelector(`[data-testid="agent-work-cycle-${targetId}"]`);
    return button && !button.disabled;
  }, managedResponseTargetButtonId, { timeout: 15000 });
  await page.getByTestId(`agent-work-cycle-${managedResponseTargetButtonId}`).click();
  await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.name === 'Manager Demo: Autonomous Agent Studio');
      return Boolean(
        project?.agentWorkerLedger?.[0]?.agentId === managedResponseTargetButtonId
        && project.agentWorkerLedger[0].managementResponseTargetIds?.includes('turing')
        && project.logs?.some((log) => log.eventType === 'management-response' && log.agentId === managedResponseTargetButtonId && log.targetAgentId === 'turing')
        && snapshot.messages.some((message) => message.projectId === project.id && message.agentWorker?.agentId === managedResponseTargetButtonId && message.agentWorker?.targetAgentId === 'turing' && /picked up your management signal/i.test(message.text || '')),
      );
    },
    'Backend-connected managed Agent Pulse must respond to the manager check-in.',
  );
  await page.waitForFunction(
    () => document.body.innerText.toUpperCase().includes('RESPONDED TO'),
    null,
    { timeout: 10000 },
  );
  await assertPageContains(page, 'RESPONDED TO', 'Backend-connected managed Agent Pulse must expose management response targets in the Team row.');
  await page.getByTestId('agent-message-target-musk').selectOption('turing');
  await page.getByTestId('agent-message-input-musk').fill('Coordination note: manager-ui-agent-message-proof must stay visible.');
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="agent-message-send-musk"]');
    return button && !button.disabled;
  }, null, { timeout: 15000 });
  await page.getByTestId('agent-message-send-musk').click();
  await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.name === 'Manager Demo: Autonomous Agent Studio');
      return Boolean(
        project?.agentStates?.turing?.inbox?.some((item) => item.sourceMessageId?.startsWith('manager_ui_agent_message_musk_') && /manager-ui-agent-message-proof/i.test(item.text || ''))
        && project?.agentStates?.musk?.worklog?.some((item) => item.sourceMessageId?.startsWith('manager_ui_agent_message_musk_'))
        && project?.logs?.some((log) => log.eventType === 'agent-message' && log.messageId?.startsWith('manager_ui_agent_message_musk_') && /manager-ui-agent-message-proof/i.test(log.log || ''))
        && project?.eventLedger?.some((event) => event.source === 'agent-to-agent-message' && /manager-ui-agent-message-proof/i.test(event.summary || ''))
        && snapshot.messages.some((message) => message.projectId === project.id && message.source === 'agent-to-agent-message' && /manager-ui-agent-message-proof/i.test(message.text || '')),
      );
    },
    'Backend-connected Agent Message must persist sender worklog, target inbox, chat message, and event-ledger proof.',
  );
  await assertPageContains(page, 'MANAGER-UI-AGENT-MESSAGE-PROOF', 'Backend-connected Agent Message must update the target Agent inbox row.');
  await assertPageContains(page, 'Agent Communication Flow', 'Backend-connected Agent Message must surface in the Agent communication flow.');
  await assertPageContains(page, 'Agent Message Delivery Matrix', 'Backend-connected Agent Message must expose per-target delivery proof.');
  await assertPageContains(page, 'Agent-to-Agent message routes', 'Backend-connected Agent Message must surface in the Manager Proof Map route card.');
  await assertPageContains(page, 'Agent message timeline proof', 'Backend-connected Agent Message Proof Map card must expose timeline proof.');
  await assertPageContains(page, 'Direct Receipt', 'Agent Message Delivery Matrix must show direct receipt status.');
  await assertPageContains(page, 'Target Inbox', 'Agent Message Delivery Matrix must show target inbox status.');
  await page.getByTestId('agent-message-delivery-matrix').getByRole('button', { name: /Delivery chat proof/i }).first().click();
  await assertPageContains(page, 'PROOF FOCUS:', 'Agent Message Delivery Matrix proof must jump to exact group-chat evidence.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Delivered Messages', 'Backend manager snapshot must include delivered Agent message counts.');
  await assertPageContains(page, 'Sender Worklog', 'Agent communication flow must expose sender worklog proof state.');
  await page.getByTestId('agent-communication-flow').getByRole('button', { name: /Agent chat proof/i }).first().click();
  await assertPageContains(page, 'PROOF FOCUS:', 'Agent communication flow proof must jump to exact chat evidence.');
  await assertPageContains(page, 'MANAGER-UI-AGENT-MESSAGE-PROOF', 'Agent communication proof focus must include the sent Agent message.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await page.getByTestId('agent-inbox-proof-turing').click();
  await assertPageContains(page, 'PROOF FOCUS:', 'Backend-connected Agent inbox proof must jump to exact chat evidence.');
  await assertPageContains(page, 'HEARD BY', 'Backend-connected chat proof must show named message recipients.');
  await assertPageContains(page, 'DIRECT TARGET', 'Backend-connected chat proof must show named direct targets.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await page.getByTestId('agent-worklog-timeline-turing').click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:', 'Backend-connected Agent worklog proof must jump to exact timeline evidence.');
  await page.getByTestId('timeline-evidence-detail').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'SOURCE CHANNEL', 'Timeline detail must expose source channel evidence.');
  await assertPageContains(page, 'RECEIPTS', 'Timeline detail must expose receipt evidence.');
  await assertPageContains(page, 'DIRECT TARGETS', 'Timeline detail must expose direct-target evidence.');
  await backToDashboard(page);

  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Agent Management Mesh', 'Backend-connected dashboard must expose Agent management relationships.');
  await assertPageContains(page, 'Leader Chain', 'Agent management mesh must show the Leader chain.');
  await assertPageContains(page, 'Managed Agents', 'Agent management mesh must show managed Agents.');
  await assertPageContains(page, 'Latest Check-in', 'Agent management mesh must show the latest check-in.');
  await assertPageContains(page, 'Management Proof', 'Agent management mesh must show timeline proof counts.');
  await assertPageContains(page, 'RESPONSE', 'Agent management mesh must show management response counts.');
  await assertPageContains(page, 'Peer Management Matrix', 'Agent management mesh must expose the explicit peer-management matrix.');
  await assertPageContains(page, 'Every independent Agent has a peer manager and a peer target', 'Peer-management matrix must explain mutual Agent management.');
  await page.getByTestId('peer-management-matrix-turing').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('management-mesh-turing').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Run Management Sync', 'Agent management mesh must expose an explicit backend management-sync control.');
  const managementSyncSnapshotBefore = await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => snapshot.projects.find((item) => item.name === 'Manager Demo: Autonomous Agent Studio'),
    'Backend snapshot must include the project before running management sync.',
  );
  const managementSyncProjectBefore = managementSyncSnapshotBefore.projects.find((item) => item.name === 'Manager Demo: Autonomous Agent Studio');
  const managementSyncCountBefore = managementSyncProjectBefore?.agentWorkerLedger?.filter((record) => record.agentId === 'turing' && record.trigger === 'manager-ui-management-sync').length || 0;
  await page.getByTestId('agent-management-sync-turing').click();
  await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.name === 'Manager Demo: Autonomous Agent Studio');
      const syncRecords = project?.agentWorkerLedger?.filter((record) => record.agentId === 'turing' && record.trigger === 'manager-ui-management-sync') || [];
      const latestSync = syncRecords[0] || null;
      const targetId = latestSync?.managementTargetIds?.[0];
      const syncMessage = snapshot.messages.find((message) => (
        message.projectId === project?.id
        && message.agentWorker?.agentId === 'turing'
        && message.agentWorker?.trigger === 'manager-ui-management-sync'
        && message.agentWorker?.targetAgentId === targetId
      ));
      return Boolean(
        syncRecords.length > managementSyncCountBefore
        && latestSync?.cadence === 'management-sync'
        && latestSync?.managementEventCount > 0
        && targetId
        && syncMessage
        && project.logs?.some((log) => log.agentId === 'turing' && log.targetAgentId === targetId && /management-check-in/.test(log.eventType || ''))
        && project.agentStates?.[targetId]?.inbox?.some((item) => item.sourceMessageId === syncMessage.id),
      );
    },
    'Backend management sync must publish a management check-in and deliver it into the managed Agent inbox.',
  );
  await page.getByRole('button', { name: /Management timeline proof/i }).first().click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:', 'Agent management mesh proof must jump to management timeline evidence.');
  await assertPageContains(page, 'management', 'Agent management mesh proof must include management event evidence.');
  await backToDashboard(page);

  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Manager Proof Map', 'Backend-connected dashboard must expose the manager proof map.');
  await assertPageContains(page, 'Every readiness condition has a direct evidence route', 'Manager proof map must explain its evidence route purpose.');
  await assertPageContains(page, 'Transcript Proof Coverage', 'Manager proof map must expose backend transcript proof coverage.');
  await assertPageContains(page, 'Transcript coverage proof', 'Manager proof map must expose a transcript coverage proof action.');
  await page.getByTestId('proof-map-collaboration-intent-queue').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Collaboration Intent Queue', 'Manager proof map must expose Collaboration Intent Queue route proof.');
  await assertPageContains(page, 'Intent chat proof', 'Manager proof map must expose Collaboration Intent Queue chat proof.');
  await assertPageContains(page, 'Intent timeline proof', 'Manager proof map must expose Collaboration Intent Queue timeline proof.');
  await page.getByTestId('proof-map-collaboration-intent-chat-open').click();
  await assertPageContains(page, 'PROOF FOCUS:', 'Collaboration Intent Queue proof map chat route must open transcript evidence.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await page.getByTestId('proof-map-collaboration-intent-timeline-open').click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:', 'Collaboration Intent Queue proof map timeline route must open timeline evidence.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await page.getByTestId('proof-map-submission-review-workflow').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Submission Review Workflow', 'Manager proof map must expose submission review workflow route proof.');
  await assertPageContains(page, 'Review chat proof', 'Manager proof map must expose submission review chat proof.');
  await assertPageContains(page, 'Review timeline proof', 'Manager proof map must expose submission review timeline proof.');
  await page.getByTestId('proof-map-submission-review-chat-open').click();
  await assertPageContains(page, 'PROOF FOCUS:', 'Submission Review Workflow proof map chat route must open transcript evidence.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await page.getByTestId('proof-map-submission-review-timeline-open').click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:', 'Submission Review Workflow proof map timeline route must open timeline evidence.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await page.getByTestId('proof-map-product-team-acceptance-chain').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Generic Product-Team Acceptance Chain', 'Manager proof map must expose the generic product-team acceptance chain route proof.');
  await assertPageContains(page, 'Chain chat proof', 'Manager proof map must expose acceptance chain chat proof.');
  await assertPageContains(page, 'Chain timeline proof', 'Manager proof map must expose acceptance chain timeline proof.');
  await page.getByTestId('proof-map-acceptance-chain-chat-open').click();
  await assertPageContains(page, 'PROOF FOCUS:', 'Product-team acceptance chain proof map chat route must open transcript evidence.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await page.getByTestId('proof-map-acceptance-chain-timeline-open').click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:', 'Product-team acceptance chain proof map timeline route must open timeline evidence.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await page.getByTestId('proof-map-product-team-delivery-trace').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Product Team Delivery Trace', 'Manager proof map must expose product-team delivery trace route proof.');
  await assertPageContains(page, 'Delivery chat proof', 'Manager proof map must expose delivery trace chat proof.');
  await assertPageContains(page, 'Delivery timeline proof', 'Manager proof map must expose delivery trace timeline proof.');
  await page.getByTestId('proof-map-delivery-trace-chat-open').click();
  await assertPageContains(page, 'PROOF FOCUS:', 'Product Team Delivery Trace proof map chat route must open transcript evidence.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await page.getByTestId('proof-map-delivery-trace-timeline-open').click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:', 'Product Team Delivery Trace proof map timeline route must open timeline evidence.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await page.getByTestId('proof-map-role-clarification').getByRole('button', { name: /Kickoff chat proof/i }).click();
  await assertPageContains(page, 'PROOF FOCUS:', 'Manager proof map kickoff route must open exact chat evidence.');
  await assertPageContains(page, 'Leader Election', 'Manager proof map kickoff route must show kickoff/leader-election transcript evidence.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await page.getByTestId('proof-map-timeline-progress').getByRole('button', { name: /Timeline proof/i }).click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:', 'Manager proof map timeline route must open exact timeline evidence.');
  await page.getByTestId('timeline-evidence-detail').waitFor({ state: 'visible', timeout: 5000 });
  await backToDashboard(page);

  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Leader Assignment Flow', 'Backend-connected dashboard must expose the Leader assignment proof chain.');
  await assertPageContains(page, 'Group @Assignment', 'Leader assignment flow must show the source group @assignment stage.');
  await assertPageContains(page, 'Assignee Inbox', 'Leader assignment flow must show the assigned Agent inbox stage.');
  await assertPageContains(page, 'Acknowledgement', 'Leader assignment flow must show the Agent acknowledgement stage.');
  await assertPageContains(page, 'Work Pulse', 'Leader assignment flow must show downstream work-pulse evidence.');
  await assertPageContains(page, 'Timeline Proof', 'Leader assignment flow must show timeline publication evidence.');
  await assertPageContains(page, 'Assignment Timeline Matrix', 'Leader assignment flow must expose the assignment timeline matrix.');
  await assertPageContains(page, 'Assignee Saw It', 'Assignment timeline matrix must show assignee receipt.');
  await assertPageContains(page, 'Assignment Timeline Event', 'Assignment timeline matrix must show timeline event proof.');
  await page.getByTestId('assignment-timeline-matrix').getByRole('button', { name: /Assignment timeline event proof/i }).first().click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:', 'Assignment timeline matrix proof must jump to exact timeline evidence.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Assignment Work Progress Matrix', 'Leader assignment flow must expose assigned-work progress proof.');
  await assertPageContains(page, 'Progress Chat', 'Assignment work progress matrix must show progress chat publication.');
  await assertPageContains(page, 'Timeline Progress', 'Assignment work progress matrix must show timeline progress publication.');
  await assertPageContains(page, 'Completion Proof', 'Assignment work progress matrix must show completion proof state.');
  await page.getByTestId('assignment-work-progress-matrix').getByRole('button', { name: /Progress timeline proof/i }).first().click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:', 'Assignment work progress proof must jump to exact timeline evidence.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Assignment Timeline', 'Backend manager snapshot must include assignment timeline counts.');
  await assertPageContains(page, 'Assignment Progress', 'Backend manager snapshot must include assignment progress counts.');
  await page.getByRole('button', { name: /Assignment chat proof/i }).first().click();
  await assertPageContains(page, 'PROOF FOCUS:', 'Leader assignment flow chat proof must jump to exact group-chat evidence.');
  await assertPageContains(page, 'HEARD BY', 'Leader assignment flow chat proof must preserve receipt evidence.');
  await assertPageContains(page, 'DIRECT TARGET', 'Leader assignment flow chat proof must preserve direct @target evidence.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await page.getByRole('button', { name: /Assignment timeline proof/i }).first().click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:', 'Leader assignment flow timeline proof must jump to exact timeline evidence.');
  await page.getByTestId('timeline-evidence-detail').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'SOURCE CHANNEL', 'Leader assignment flow timeline proof must expose source channel evidence.');
  await assertPageContains(page, 'DIRECT TARGETS', 'Leader assignment flow timeline proof must expose direct target evidence.');
  await backToDashboard(page);

  await scrollDashboardToBottom(page);
  await clickDashboardStep(page, 'google_change');
  await sendChatPrefill(page, 'Google Chat', '@all add export summary feature');
  await assertPageContains(page, 'Confirmed. I am adding "@all add export summary feature"', 'Backend-connected Google Chat change must render owner confirmation.');
  await backToDashboard(page);

  await clickDashboardStep(page, 'meeting_change');
  await sendMeetingPrefill(page, 'manager meeting recap packet');
  await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => snapshot.projects.some((project) => (
      project.name === 'Manager Demo: Autonomous Agent Studio'
      && project.changeLedger?.some((change) => change.source === 'war-room-meeting-change-request' && /manager meeting recap packet/i.test(changeLedgerText(change)))
    )),
    'Backend-connected War Room change must persist to the backend change ledger.',
  );
  await assertPageContains(page, 'manager meeting recap packet', 'Backend-connected War Room change must render the submitted meeting request.');
  await backToDashboard(page);
  await clickDashboardStep(page, 'dual_channel_change');
  await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => snapshot.projects.some((project) => (
      project.name === 'Manager Demo: Autonomous Agent Studio'
      && project.changeLedger?.some((change) => change.source === 'multi-channel-change-request' && change.sourceMessageIds?.length === 2 && change.sourceModes?.includes('war_room_meeting') && change.sourceModes?.includes('google_chat'))
    )),
    'Backend-connected dual-channel change must persist through the unified backend endpoint.',
  );
  await assertPageContains(page, 'dual-channel manager review packet', 'Backend-connected dual-channel change must render in the manager dashboard.');
  await assertPageContains(page, 'War Room + Google Chat', 'Backend-connected dual-channel change must expose both source channels.');
  await assertPageContains(page, 'Source Request', 'Backend-connected change ledger must expose the source request stage.');
  await assertPageContains(page, 'Team Discussion', 'Backend-connected change ledger must expose discussion stage.');
  await assertPageContains(page, 'Owner Confirmation', 'Backend-connected change ledger must expose owner confirmation stage.');
  await assertPageContains(page, 'Owner Plan', 'Backend-connected change ledger must expose owner plan update stage.');
  await assertPageContains(page, 'Team Sync', 'Backend-connected change ledger must expose team sync stage.');
  await assertPageContains(page, 'Dual-channel Change Intake Matrix', 'Backend-connected dashboard must expose channel-level change intake proof.');
  await assertPageContains(page, 'Source Message', 'Dual-channel change intake matrix must show source message state.');
  await assertPageContains(page, 'Source Receipts', 'Dual-channel change intake matrix must show source receipt state.');
  await assertPageContains(page, 'Team Discussed', 'Dual-channel change intake matrix must show discussion state.');
  await page.getByTestId('dual-channel-change-intake-matrix').getByRole('button', { name: /Source channel proof/i }).first().click();
  await assertPageContains(page, 'PROOF FOCUS:', 'Dual-channel source proof must jump to exact source chat evidence.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Change Resolution Matrix', 'Backend-connected dashboard must expose the full change resolution matrix.');
  await assertPageContains(page, 'Owner First Work', 'Change Resolution Matrix must expose the owner first work pulse stage.');
  await page.getByTestId('change-resolution-matrix').getByRole('button', { name: /Owner work timeline proof/i }).first().click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:', 'Change Resolution Matrix owner work proof must jump to exact timeline evidence.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Change Intake', 'Backend manager snapshot must include change intake source counts.');
  await assertPageContains(page, 'Scenario Trail', 'Backend manager snapshot must include scenario trail coverage.');
  await page.getByTestId('manager-scenario-trail-proof-dual-channel-change').click();
  await assertPageContains(page, 'PROOF FOCUS:', 'Manager scenario trail change proof must jump to exact source chat evidence.');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Change Owner Pulses', 'Backend manager snapshot must include change owner work pulse counts.');
  await assertPageContains(page, 'Discussion Receipts', 'Backend-connected change ledger must expose Agent receipt coverage for change discussion.');
  await assertPageContains(page, 'Sync Targets', 'Backend-connected change ledger must name synchronized Agents.');
  await page.getByTestId('backend-autonomous-run-control-loop-run').scrollIntoViewIfNeeded();
  await page.getByTestId('backend-autonomous-run-control-loop-run').click();
  await page.getByTestId('backend-autonomous-run-control-loop-receipt').waitFor({ state: 'visible', timeout: 12000 });
  await assertPageContains(page, 'Loop receipt:', 'Running the autonomous control loop must render a backend loop receipt.');

  const snapshot = await fetch(`${backendRuntime.url}/snapshot`).then((response) => response.json());
  const managerProject = snapshot.projects.find((project) => project.name === 'Manager Demo: Autonomous Agent Studio');
  assert(managerProject, 'Backend UI validation must persist the manager demo project to the backend store.');
  assert(managerProject.autonomousSchedulerLedger?.some((record) => record.trigger === 'manager-ui-backend-pulse'), 'Server Pulse must run through the backend scheduler tick route.');
  assert(snapshot.messages.some((message) => message.projectId === managerProject.id && message.source === 'manager-ui-backend-station-chat'), 'Server Pulse must persist backend-published chat messages.');
  assert(managerProject.agentWorkerLedger?.some((record) => record.trigger === 'manager-ui-backend-pulse-agents'), 'Server Pulse must also run backend Agent workers through the scheduler tick route.');
  assert(managerProject.agentWorkerLedger?.some((record) => record.trigger === 'manager-ui-hourly-pulse-agents'), 'Hour Pulse must also run backend Agent workers through the scheduler tick route.');
  const controlRunReceipt = managerProject.autonomousRunControlRunLedger?.find((record) => record.schemaVersion === 'autonomous-run-control-action-run/v1' && record.runApiPath?.includes('/autonomous-run-control/'));
  const delegatedAgentControlRunReceipt = managerProject.autonomousRunControlRunLedger?.find((record) => record.schemaVersion === 'autonomous-run-control-action-run/v1' && record.runApiPath?.includes('/autonomous-run-control/') && record.agentId && record.actionLane === 'agent-autonomy');
  const controlLoopReceipt = managerProject.autonomousRunControlLoopLedger?.find((record) => record.schemaVersion === 'autonomous-run-control-loop-run/v1' && record.runApiPath?.endsWith('/autonomous-run-control/run-loop'));
  assert(controlRunReceipt, 'Autonomous Run Control UI action must persist a backend run receipt ledger entry.');
  assert(delegatedAgentControlRunReceipt, 'Autonomous Run Control UI action must delegate a runnable Agent action with Agent ownership.');
  assert(controlLoopReceipt && typeof controlLoopReceipt.stepCount === 'number' && Array.isArray(controlLoopReceipt.runReceiptIds), 'Autonomous Run Control loop must persist a backend bounded-loop receipt ledger entry.');
  assert(managerProject.eventLedger?.some((event) => event.type === 'autonomous-run-control-action-run'), 'Autonomous Run Control UI action must persist an event-ledger proof.');
  assert(managerProject.agentWorkerLedger?.some((record) => record.agentId === 'turing' && record.trigger === 'manager-ui-agent-pulse' && typeof record.managementPriority === 'number' && Array.isArray(record.managementReasons)), 'Backend-connected Agent Pulse must persist per-Agent worker ledger priority evidence.');
  assert(managerProject.agentWorkerLedger?.some((record) => record.managementResponseTargetIds?.includes('turing') && record.managementResponseCount > 0), 'Backend-connected managed Agent Pulse must persist management response targets in the worker ledger.');
  assert(managerProject.logs?.some((log) => log.eventType === 'management-response' && log.targetAgentId === 'turing'), 'Backend-connected managed Agent Pulse must persist management response timeline proof.');
  assert(snapshot.messages.some((message) => message.projectId === managerProject.id && message.agentWorker?.agentId === 'turing'), 'Backend-connected Agent Pulse must persist per-Agent chat proof.');
  assert(managerProject.changeLedger?.some((change) => change.source === 'google-chat-mention-change-request' && /export summary feature/i.test(changeLedgerText(change))), 'Backend-connected Google Chat change must persist to the backend change ledger.');
  assert(managerProject.changeLedger?.some((change) => change.source === 'war-room-meeting-change-request' && /manager meeting recap packet/i.test(changeLedgerText(change))), 'Backend-connected War Room change must persist to the backend change ledger.');
  assert(managerProject.changeLedger?.some((change) => change.source === 'multi-channel-change-request' && change.sourceMessageIds?.length === 2 && change.sourceModes?.includes('war_room_meeting') && change.sourceModes?.includes('google_chat') && /dual-channel manager review packet/i.test(changeLedgerText(change))), 'Backend-connected dual-channel change must persist one unified multi-source change ledger entry.');
  assert(snapshot.messages.some((message) => message.projectId === managerProject.id && message.id && /export summary feature/i.test(message.text || '')), 'Backend-connected Google Chat change must persist source and discussion messages.');
  const transcriptIndex = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/transcripts`).then((response) => response.json());
  assert(transcriptIndex.recoverableProofCount > 0 && transcriptIndex.channels?.some((channel) => channel.channelId === 'main' && channel.messageCount > 0 && channel.totalProofCount >= channel.messageCount), 'Backend transcript index must expose current and recoverable main-channel proof.');
  const mainTranscript = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/transcripts/main`).then((response) => response.json());
  assert(mainTranscript.messages?.length > 0 && mainTranscript.summary?.totalProofCount >= mainTranscript.messages.length, 'Backend channel transcript must expose current messages plus recoverable proof summary.');
  const readinessProofMap = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/readiness-proof-map`).then((response) => response.json());
  assert(readinessProofMap.status === 'manager-ready' && readinessProofMap.routes?.some((route) => route.checkId === 'role-clarification' && route.apiPath.endsWith('/transcripts/main')), 'Backend readiness proof map must expose kickoff transcript routes.');
  assert(readinessProofMap.routes?.some((route) => route.checkId === 'management-loop-running' && route.proofKind === 'timeline' && route.timelineLogIds.length > 0), 'Backend readiness proof map must expose management timeline routes.');
  assert(readinessProofMap.transcriptProofCoverageSummary?.routeReady === true && Array.isArray(readinessProofMap.transcriptProofCoverageRoutes), 'Backend readiness proof map must expose transcript proof coverage summary and routes for C-side monitoring.');
  const managerDashboard = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/manager-dashboard`).then((response) => response.json());
  assert(managerDashboard.readiness?.status === 'manager-ready' && managerDashboard.operationsBoard?.agents?.length > 0, 'Backend manager dashboard endpoint must expose readiness plus Agent operations rows.');
  assert(managerDashboard.launchApprovalWorkflow?.schemaVersion === 'launch-approval-workflow/v1' && managerDashboard.launchApprovalWorkflow?.readyForProduction === false, 'Backend manager dashboard endpoint must expose launch approval workflow without production overclaim.');
  assert(managerDashboard.autonomousRunControlRuns?.rows?.some((row) => row.schemaVersion === 'autonomous-run-control-action-run/v1' && row.timelineLogIds?.length && row.eventIds?.length), 'Backend manager dashboard endpoint must expose autonomous run control run receipts with timeline and event proof.');
  assert(managerDashboard.autonomousRunControlLoops?.rows?.some((row) => row.schemaVersion === 'autonomous-run-control-loop-run/v1' && row.timelineLogIds?.length && row.eventIds?.length), 'Backend manager dashboard endpoint must expose autonomous run control loop receipts with timeline and event proof.');
  const managerReadyPackage = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/manager-ready-package`).then((response) => response.json());
  assert(managerReadyPackage.launchApprovalWorkflow?.schemaVersion === 'launch-approval-workflow/v1' && managerReadyPackage.backendRoutes?.launchApprovals?.endsWith('/launch-approvals'), 'Backend manager ready package endpoint must expose launch approval workflow and route.');
  assert(managerReadyPackage.brainstormLayer?.schemaVersion === 'brainstorm-layer/v1' && managerReadyPackage.brainstormLayer?.backendRoutes?.brainstormLayer?.endsWith('/brainstorm-layer'), 'Backend manager ready package endpoint must expose brainstorm layer and route.');
  assert(managerReadyPackage.autonomousRunControl?.schemaVersion === 'autonomous-run-control/v1' && managerReadyPackage.autonomousRunControl?.backendRoutes?.autonomousRunControl?.endsWith('/autonomous-run-control'), 'Backend manager ready package endpoint must expose autonomous run control and route.');
  assert(typeof managerReadyPackage.autonomousRunControl?.summary?.runnableActionCount === 'number' && managerReadyPackage.autonomousRunControl?.workerQueue?.schemaVersion === 'worker-queue-snapshot/v1', 'Backend manager ready package autonomous run control must expose runnable action counts and worker queue proof.');
  assert(managerReadyPackage.autonomousRunControlRuns?.count >= 1 && managerReadyPackage.summary?.autonomousRunControlRunCount >= 1, 'Backend manager ready package endpoint must summarize autonomous run control run receipts.');
  assert(managerReadyPackage.autonomousRunControlLoops?.count >= 1 && managerReadyPackage.summary?.autonomousRunControlLoopCount >= 1, 'Backend manager ready package endpoint must summarize autonomous run control loop receipts.');
  const productTeamOperatingLoop = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/product-team-operating-loop`).then((response) => response.json());
  assert(productTeamOperatingLoop.productTeamOperatingLoop?.schemaVersion === 'product-team-operating-loop/v1' && productTeamOperatingLoop.productTeamOperatingLoop?.backendRoutes?.productTeamOperatingLoop?.endsWith('/product-team-operating-loop'), 'Backend product-team operating loop endpoint must expose its standalone route.');
  assert(productTeamOperatingLoop.productTeamOperatingLoop?.customerSide?.nextAction?.runApiPath?.includes('/autonomous-run-control/') && productTeamOperatingLoop.productTeamOperatingLoop?.agentSide?.selectedActions?.length > 0, 'Backend product-team operating loop must join C-side continuation with A-side Agent strategy selection.');
  assert(productTeamOperatingLoop.productTeamOperatingLoop?.deliveryLoop?.readyStageIds?.length >= 1 && productTeamOperatingLoop.productTeamOperatingLoop?.proofLoop?.eventIds?.length > 0, 'Backend product-team operating loop must expose delivery and proof/event evidence.');
  assert(productTeamOperatingLoop.productTeamOperatingLoop?.gates?.some((gate) => gate.id === 'production-autonomy-boundary' && gate.productionBlocker && gate.passed === false), 'Backend product-team operating loop must keep production autonomy blocked.');
  assert(managerReadyPackage.productionLaunchAudit?.productionGates?.some((gate) => gate.id === 'managed-production-evidence-integrity' && gate.passed === false && gate.apiPath?.endsWith('/production-evidence-integrity-audit')), 'Backend manager ready package production launch audit must gate production on managed-production evidence integrity.');
  assert(managerReadyPackage.productionLaunchGapRegister?.gapRows?.some((row) => row.id === 'managed-production-evidence-integrity' && row.apiPath?.endsWith('/production-evidence-integrity-audit')), 'Backend manager ready package production gap register must expose managed-production evidence integrity as a routed gap.');
  assert(managerReadyPackage.productionLaunchControlCenter?.schemaVersion === 'production-launch-control-center/v1' && managerReadyPackage.productionLaunchControlCenter?.readyForProduction === false && managerReadyPackage.productionLaunchControlCenter?.backendRoutes?.productionLaunchControlCenter?.endsWith('/production-launch-control-center'), 'Backend manager ready package endpoint must expose production launch control center and keep production blocked.');
  assert(managerReadyPackage.productionLaunchControlCenter?.controlRows?.some((row) => row.id === 'managed-production-evidence-integrity' && row.ready === false && row.apiPath?.endsWith('/production-evidence-integrity-audit')), 'Backend manager ready package production launch control center must gate production on managed-production evidence integrity.');
  assert(managerReadyPackage.productionLaunchEvidenceDossier?.schemaVersion === 'production-launch-evidence-dossier/v1' && managerReadyPackage.productionLaunchEvidenceDossier?.readyForProduction === false && managerReadyPackage.productionLaunchEvidenceDossier?.backendRoutes?.productionLaunchEvidenceDossier?.endsWith('/production-launch-evidence-dossier'), 'Backend manager ready package endpoint must expose production launch evidence dossier and keep production blocked.');
  assert(managerReadyPackage.productionLaunchEvidenceDossier?.summary?.manifestEntryCount >= 9 && managerReadyPackage.productionLaunchEvidenceDossier?.controlDomainRows?.length === 4, 'Backend manager ready package production launch evidence dossier must expose manifest and production control domains.');
  assert(managerReadyPackage.productionEvidenceIntegrityAudit?.schemaVersion === 'production-evidence-integrity-audit/v1' && managerReadyPackage.productionEvidenceIntegrityAudit?.readyForProduction === false && managerReadyPackage.productionEvidenceIntegrityAudit?.backendRoutes?.productionEvidenceIntegrityAudit?.endsWith('/production-evidence-integrity-audit'), 'Backend manager ready package endpoint must expose production evidence integrity audit and keep production blocked without managed-production proof.');
  assert(managerReadyPackage.productionDeploymentControlReceiptWorkflow?.schemaVersion === 'production-deployment-control-receipt-workflow/v1' && managerReadyPackage.productionDeploymentControlReceiptWorkflow?.readyForProductionDeployment === false && managerReadyPackage.productionDeploymentControlReceiptWorkflow?.backendRoutes?.productionDeploymentControlReceipts?.endsWith('/production-deployment-control-receipts'), 'Backend manager ready package endpoint must expose production deployment control receipt workflow and route.');
  assert(managerReadyPackage.productionSecurityControlReceiptWorkflow?.schemaVersion === 'production-security-control-receipt-workflow/v1' && managerReadyPackage.productionSecurityControlReceiptWorkflow?.readyForProductionSecurity === false && managerReadyPackage.productionSecurityControlReceiptWorkflow?.backendRoutes?.productionSecurityControlReceipts?.endsWith('/production-security-control-receipts'), 'Backend manager ready package endpoint must expose production security control receipt workflow and route.');
  assert(managerReadyPackage.productionProviderControlReceiptWorkflow?.schemaVersion === 'production-provider-control-receipt-workflow/v1' && managerReadyPackage.productionProviderControlReceiptWorkflow?.readyForProductionProvider === false && managerReadyPackage.productionProviderControlReceiptWorkflow?.backendRoutes?.productionProviderControlReceipts?.endsWith('/production-provider-control-receipts'), 'Backend manager ready package endpoint must expose production provider control receipt workflow and route.');
  const productionLaunchControlCenter = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/production-launch-control-center`).then((response) => response.json());
  assert(productionLaunchControlCenter.productionLaunchControlCenter?.schemaVersion === 'production-launch-control-center/v1' && productionLaunchControlCenter.productionLaunchControlCenter?.controlRows?.length >= 8 && productionLaunchControlCenter.productionLaunchControlCenter?.readyForProduction === false, 'Backend production launch control center endpoint must expose gate rows without production overclaim.');
  assert(productionLaunchControlCenter.productionLaunchControlCenter?.controlRows?.some((row) => row.id === 'managed-production-evidence-integrity' && row.ready === false && row.apiPath?.endsWith('/production-evidence-integrity-audit')), 'Backend production launch control center endpoint must expose managed-production evidence integrity as a blocked gate.');
  const productionLaunchEvidenceDossier = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/production-launch-evidence-dossier`).then((response) => response.json());
  assert(productionLaunchEvidenceDossier.productionLaunchEvidenceDossier?.schemaVersion === 'production-launch-evidence-dossier/v1' && productionLaunchEvidenceDossier.productionLaunchEvidenceDossier?.readyForProduction === false, 'Backend production launch evidence dossier endpoint must expose launch manifest without production overclaim.');
  assert(productionLaunchEvidenceDossier.productionLaunchEvidenceDossier?.manifest?.some((row) => row.id === 'production-launch-control-center') && productionLaunchEvidenceDossier.productionLaunchEvidenceDossier?.manifest?.some((row) => row.id === 'production-evidence-integrity-audit'), 'Backend production launch evidence dossier endpoint must aggregate launch control and evidence integrity entries.');
  const productionEvidenceIntegrityAudit = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/production-evidence-integrity-audit`).then((response) => response.json());
  assert(productionEvidenceIntegrityAudit.productionEvidenceIntegrityAudit?.schemaVersion === 'production-evidence-integrity-audit/v1' && productionEvidenceIntegrityAudit.productionEvidenceIntegrityAudit?.summary?.missingControlCount > 0 && productionEvidenceIntegrityAudit.productionEvidenceIntegrityAudit?.readyForProduction === false, 'Backend production evidence integrity audit endpoint must expose missing managed-production proof without overclaim.');
  const brainstormLayer = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/brainstorm-layer`).then((response) => response.json());
  assert(brainstormLayer.brainstormLayer?.schemaVersion === 'brainstorm-layer/v1' && brainstormLayer.brainstormLayer?.backendRoutes?.brainstormLayer?.endsWith('/brainstorm-layer'), 'Backend brainstorm layer endpoint must expose the read-only brainstorm layer contract.');
  const productionDeploymentControlReceipts = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/production-deployment-control-receipts`).then((response) => response.json());
  assert(productionDeploymentControlReceipts.productionDeploymentControlReceiptWorkflow?.schemaVersion === 'production-deployment-control-receipt-workflow/v1' && productionDeploymentControlReceipts.productionDeploymentControlReceiptWorkflow?.summary?.missingControlCount > 0, 'Backend production deployment control receipt endpoint must expose missing production deployment control counts.');
  const productionSecurityControlReceipts = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/production-security-control-receipts`).then((response) => response.json());
  assert(productionSecurityControlReceipts.productionSecurityControlReceiptWorkflow?.schemaVersion === 'production-security-control-receipt-workflow/v1' && productionSecurityControlReceipts.productionSecurityControlReceiptWorkflow?.summary?.missingControlCount > 0, 'Backend production security control receipt endpoint must expose missing production security control counts.');
  const productionProviderControlReceipts = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/production-provider-control-receipts`).then((response) => response.json());
  assert(productionProviderControlReceipts.productionProviderControlReceiptWorkflow?.schemaVersion === 'production-provider-control-receipt-workflow/v1' && productionProviderControlReceipts.productionProviderControlReceiptWorkflow?.summary?.missingControlCount > 0, 'Backend production provider control receipt endpoint must expose missing production provider control counts.');
  assert(managerDashboard.managerScenarioTrail?.rows?.some((row) => row.id === 'dual-channel-change' && row.passed) && managerDashboard.managerScenarioTrail?.rows?.some((row) => row.id === 'next-actions-to-autonomy' && row.passed), 'Backend manager dashboard endpoint must expose a passing end-to-end manager scenario trail.');
  assert(managerDashboard.syncProtocolAudit?.rows?.some((row) => row.id === 'leader-assignment-sync' && row.complete) && managerDashboard.syncProtocolAudit?.rows?.some((row) => row.id === 'change-request-sync' && row.complete), 'Backend manager dashboard endpoint must expose completed sync protocol audit rows for assignment and change flows.');
  assert(managerDashboard.managerCommandCenter?.nextBestAction?.canRun && managerDashboard.managerCommandCenter?.liveLanes?.some((lane) => lane.id === 'workers') && managerDashboard.managerCommandCenter?.agentRows?.length > 0, 'Backend manager dashboard endpoint must expose the live command center.');
  const managerCommandCenter = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/manager-command-center`).then((response) => response.json());
  assert(managerCommandCenter.nextBestAction?.runApiPath && managerCommandCenter.liveLanes?.some((lane) => lane.id === 'google-chat' && lane.proofCount > 0) && managerCommandCenter.kickoffBoard?.rows?.some((row) => row.id === 'leader-marker' && row.passed) && managerCommandCenter.kickoffBoard?.rows?.some((row) => row.id === 'next-actions' && row.passed) && managerCommandCenter.workLoopBoard?.rows?.some((row) => row.scheduled && row.routineReady && row.proofReady && row.timelineLogIds?.length > 0) && managerCommandCenter.collaborationBoard?.rows?.some((row) => row.id === 'leader-assignments' && row.passed && row.proofIds?.length > 0 && row.timelineLogIds?.length > 0) && managerCommandCenter.collaborationBoard?.rows?.some((row) => row.id === 'agent-messages' && row.passed && row.proofIds?.length > 0) && managerCommandCenter.changeProtocolBoard?.rows?.some((row) => row.id === 'dual-channel-source' && row.passed && row.proofIds?.length > 0) && managerCommandCenter.changeProtocolBoard?.rows?.some((row) => row.id === 'owner-plan' && row.passed) && managerCommandCenter.changeProtocolBoard?.rows?.some((row) => row.id === 'team-resync' && row.passed) && managerCommandCenter.agentRows?.length === managerDashboard.agents?.count && managerCommandCenter.agentRows?.some((row) => row.receiptState === 'received-and-working' && row.inboxProofIds?.length > 0 && row.workProofIds?.length > 0) && managerCommandCenter.changeRows?.some((row) => row.ownerConfirmed && row.ownerPlanLinked && row.teamSynced && row.ownerWorkStarted), 'Backend manager command center endpoint must expose next action, live lanes, kickoff closure, 24/7 work loop proof, collaboration proof, change protocol proof, Agent readiness, @signal receipt proof, and change owner sync proof.');
  assert(managerDashboard.managerScenarioWalkthrough?.rows?.some((row) => row.id === 'leader-group-assignment' && row.primaryAction?.canRun) && managerDashboard.managerScenarioWalkthrough?.rows?.some((row) => row.id === 'mutual-agent-management'), 'Backend manager dashboard endpoint must expose a guided scenario walkthrough with runnable primary actions.');
  const managerScenarioTrail = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/manager-scenario-trail`).then((response) => response.json());
  assert(managerScenarioTrail.rows?.some((row) => row.id === 'leader-assignment' && row.passed) && managerScenarioTrail.rows?.some((row) => row.id === 'owner-plan-sync' && row.passed), 'Backend manager scenario trail endpoint must expose the standalone passing route.');
  const managerScenarioWalkthrough = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/manager-scenario-walkthrough`).then((response) => response.json());
  assert(managerScenarioWalkthrough.rows?.some((row) => row.id === 'midproject-change-intake' && row.primaryAction?.requirementId === 'midproject-dual-channel-change') && managerScenarioWalkthrough.runnableCount > 0, 'Backend manager scenario walkthrough endpoint must expose standalone guided route metadata.');
  const managerRequirementMatrix = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/manager-requirement-matrix`).then((response) => response.json());
  assert(managerRequirementMatrix.rows?.some((row) => row.id === 'leader-election-marker' && row.passed) && managerRequirementMatrix.rows?.some((row) => row.id === 'owner-plan-and-team-sync' && row.passed), 'Backend manager requirement matrix endpoint must expose standalone requirement coverage.');
  const syncProtocolAudit = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/sync-protocol-audit`).then((response) => response.json());
  assert(['synced', 'needs-attention'].includes(syncProtocolAudit.status) && syncProtocolAudit.rows?.some((row) => row.id === 'leader-assignment-sync' && typeof row.complete === 'boolean') && syncProtocolAudit.rows?.some((row) => row.id === 'change-request-sync' && typeof row.complete === 'boolean'), 'Backend sync protocol audit endpoint must expose standalone C/A sync protocol coverage.');
  const managerUseCaseAudit = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/manager-use-case-audit`).then((response) => response.json());
  assert(managerUseCaseAudit.status === 'covered' && managerUseCaseAudit.rows?.some((row) => row.id === 'kickoff-meeting-understanding' && row.covered) && managerUseCaseAudit.rows?.some((row) => row.id === 'owner-plan-team-sync' && row.covered), 'Backend manager use case audit endpoint must expose standalone manager story coverage.');
  const managerActionQueue = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/manager-action-queue`).then((response) => response.json());
  assert(managerActionQueue.rows?.some((row) => row.requirementId === 'midproject-dual-channel-change' && row.apiPath.endsWith('/change-request') && row.routeResolved && row.requestBodyTemplate?.channelIds?.includes('google_chat') && row.requestBodyTemplate?.sourceModes?.includes('war_room_meeting')) && typeof managerActionQueue.completedCount === 'number', 'Backend manager action queue endpoint must expose executable next-action route metadata.');
  const autonomousRunControl = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/autonomous-run-control`).then((response) => response.json());
  assert(autonomousRunControl.autonomousRunControl?.schemaVersion === 'autonomous-run-control/v1' && autonomousRunControl.autonomousRunControl?.backendRoutes?.schedulerTick === '/workers/autonomous/tick', 'Backend autonomous run control endpoint must expose the scheduler tick route.');
  assert(autonomousRunControl.autonomousRunControl?.nextActions?.some((row) => row.lane === 'agent-autonomy' && row.apiPath?.endsWith('/run') && row.runApiPath?.includes('/autonomous-run-control/')) && autonomousRunControl.autonomousRunControl?.gates?.some((gate) => gate.id === 'worker-queue-snapshot-ready'), 'Backend autonomous run control endpoint must expose Agent next action, unified run route, and worker queue gate proof.');
  const collaborationIntentQueue = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/collaboration-intent-queue`).then((response) => response.json());
  assert(collaborationIntentQueue.collaborationIntentQueue?.schemaVersion === 'collaboration-intent-queue/v1' && collaborationIntentQueue.collaborationIntentQueue?.rows?.length > 0 && collaborationIntentQueue.collaborationIntentQueue?.backendRoutes?.collaborationIntentQueue?.endsWith('/collaboration-intent-queue'), 'Backend collaboration intent queue endpoint must expose the standalone C/A intent routing contract.');
  assert(collaborationIntentQueue.collaborationIntentQueue?.nextRunnableIntent?.runApiPath && collaborationIntentQueue.collaborationIntentQueue?.rows?.some((row) => row.source === 'agent-autonomous-initiative' && row.proofIds?.length && row.timelineLogIds?.length && row.eventIds?.length), 'Backend collaboration intent queue must expose runnable Agent initiative rows with proof, timeline, and event evidence.');
  const managerFlowGraph = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/manager-flow-graph`).then((response) => response.json());
  assert(managerFlowGraph.nodes?.some((node) => node.source === 'autonomousRunControlRuns' && node.subtype === 'autonomous-run-control-action-run' && node.timelineLogIds?.length && node.eventIds?.length), 'Backend manager flow graph must expose autonomous run control run receipt nodes.');
  assert(managerFlowGraph.edges?.some((edge) => edge.source === 'autonomousRunControlRuns' && edge.fromNodeId === 'autonomous-run-control'), 'Backend manager flow graph must connect autonomous run control to run receipt nodes.');
  assert(managerFlowGraph.nodes?.some((node) => node.source === 'autonomousRunControlLoops' && node.subtype === 'autonomous-run-control-loop-run' && node.timelineLogIds?.length && node.eventIds?.length), 'Backend manager flow graph must expose autonomous run control loop receipt nodes.');
  assert(managerFlowGraph.nodes?.some((node) => node.id === 'product-team-operating-loop' && node.source === 'productTeamOperatingLoop' && node.route?.endsWith('/product-team-operating-loop') && node.attachments?.some((attachment) => attachment.type === 'operating-loop-c-side') && node.attachments?.some((attachment) => attachment.type === 'operating-loop-a-side') && node.attachments?.some((attachment) => attachment.type === 'operating-loop-proof') && node.attachments?.some((attachment) => attachment.type === 'operating-loop-gate' && attachment.status === 'production-blocked')), 'Backend manager flow graph must expose the Product Team Operating Loop aggregate node with C-side, A-side, proof, and production-boundary attachments.');
  assert(managerFlowGraph.edges?.some((edge) => edge.source === 'productTeamOperatingLoop' && edge.fromNodeId === 'product-team-delivery-trace' && edge.toNodeId === 'product-team-operating-loop') && managerFlowGraph.edges?.some((edge) => edge.source === 'productTeamOperatingLoop' && edge.fromNodeId === 'autonomous-run-control' && edge.toNodeId === 'product-team-operating-loop'), 'Backend manager flow graph must connect Delivery Trace and Autonomous Run Control into the Product Team Operating Loop.');
  assert(managerFlowGraph.nodes?.some((node) => node.id === 'collaboration-intent-queue' && node.source === 'collaborationIntentQueue' && node.route?.endsWith('/collaboration-intent-queue') && node.proofIds?.length && node.timelineLogIds?.length && node.eventIds?.length), 'Backend manager flow graph must expose the Collaboration Intent Queue aggregate node.');
  assert(managerFlowGraph.edges?.some((edge) => edge.source === 'collaborationIntentQueue' && edge.fromNodeId === 'team-collaboration-diagnostics' && edge.toNodeId === 'collaboration-intent-queue'), 'Backend manager flow graph must connect Team Collaboration Diagnostics into the Collaboration Intent Queue.');
  const managerReadinessProofMap = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/readiness-proof-map`).then((response) => response.json());
  assert(managerReadinessProofMap.autonomousRunControlRunRoutes?.some((route) => route.proofKind === 'autonomous-run-control-action-run' && route.timelineLogIds?.length && route.eventIds?.length), 'Backend readiness proof map must expose autonomous run control run receipt proof routes.');
  assert(managerReadinessProofMap.autonomousRunControlLoopRoutes?.some((route) => route.proofKind === 'autonomous-run-control-loop-run' && route.timelineLogIds?.length && route.eventIds?.length), 'Backend readiness proof map must expose autonomous run control loop receipt proof routes.');
  assert(managerReadinessProofMap.productTeamOperatingLoopRoutes?.some((route) => route.proofKind === 'product-team-operating-loop' && route.apiPath?.endsWith('/product-team-operating-loop') && route.deliveryTraceRoute?.endsWith('/product-team-delivery-trace') && route.autonomousRunControlRoute?.endsWith('/autonomous-run-control') && route.schedulerRoute === '/workers/autonomous/tick' && route.readyForProduction === false && route.productionBlocker === true && route.timelineLogIds?.length && route.eventIds?.length), 'Backend readiness proof map must expose the Product Team Operating Loop proof route without production overclaim.');
  assert(managerReadinessProofMap.collaborationIntentQueueRoutes?.some((route) => route.proofKind === 'collaboration-intent-queue' && route.apiPath?.endsWith('/collaboration-intent-queue') && route.agentAutonomousActionQueueRoute?.endsWith('/agent-autonomous-action-queue') && typeof route.readyForLocalPilotIntentQueue === 'boolean' && route.readyForProduction === false && route.productionBlocker === true && route.proofIds?.length && route.timelineLogIds?.length && route.eventIds?.length), 'Backend readiness proof map must expose the Collaboration Intent Queue proof route without production overclaim.');
  assert(managerReadinessProofMap.managerUseCaseAuditRoutes?.some((route) => route.proofKind === 'manager-use-case-audit' && route.apiPath?.endsWith('/manager-use-case-audit') && route.managerDashboardRoute?.endsWith('/manager-dashboard') && route.managerActionQueueRoute?.endsWith('/manager-action-queue') && route.readyForLocalManagerUseCaseAudit === true && route.productionBlocker === true && route.timelineLogIds?.length && route.eventIds?.length), 'Backend readiness proof map must expose Manager Use Case Audit as a route-backed C-side proof surface.');
  const controlRunAgentDashboard = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/agents/${encodeURIComponent(delegatedAgentControlRunReceipt.agentId)}/dashboard`).then((response) => response.json());
  assert(controlRunAgentDashboard.agentId === delegatedAgentControlRunReceipt.agentId && controlRunAgentDashboard.autonomousRunControlRuns?.rows?.some((row) => row.id === delegatedAgentControlRunReceipt.id && row.schemaVersion === 'autonomous-run-control-action-run/v1' && row.timelineLogIds?.length && row.eventIds?.length), 'Backend per-Agent dashboard must expose delegated autonomous run control receipts with timeline and event proof.');
  assert(controlRunAgentDashboard.proof?.autonomousRunControlRunIds?.includes(delegatedAgentControlRunReceipt.id) && controlRunAgentDashboard.backendRoutes?.autonomousRunControl?.endsWith('/autonomous-run-control'), 'Backend per-Agent dashboard proof map must link autonomous control run receipt ids back to the control route.');
  assert(managerDashboard.kickoffMeetingFlow?.conversationRows?.some((row) => row.stage === 'role-clarification') && managerDashboard.kickoffMeetingFlow?.conversationRows?.some((row) => row.stage === 'leader-campaign'), 'Backend manager dashboard endpoint must expose kickoff conversation rows.');
  assert(managerDashboard.kickoffExecutionFlow?.firstPulse?.started && managerDashboard.kickoffExecutionFlow?.nextActions?.length > 0, 'Backend manager dashboard endpoint must expose kickoff execution flow.');
  assert(managerDashboard.agents?.managementMesh?.some((row) => row.checkInCount > 0 && row.responseCount > 0) && managerDashboard.assignmentFlow?.rows?.some((row) => row.timelineSeen), 'Backend manager dashboard endpoint must expose management mesh response proof and assignment flow proof.');
  assert(managerDashboard.assignmentTimelineMatrix?.rows?.some((row) => row.assignmentPosted && row.assigneeReceived && row.timelineRecorded), 'Backend manager dashboard endpoint must expose assignment timeline matrix proof.');
  assert(managerDashboard.assignmentWorkProgress?.rows?.some((row) => row.progressPublished && row.timelineProgressLogIds?.length > 0) && typeof managerDashboard.assignmentWorkProgress.progressReadyCount === 'number', 'Backend manager dashboard endpoint must expose assigned-work progress timeline proof.');
  assert(managerDashboard.agents?.peerManagementMatrix?.length === managerDashboard.agents?.count && managerDashboard.agents.peerManagementMatrix.every((row) => row.peerManagedIds?.length > 0 && row.peerManagerIds?.length > 0), 'Backend manager dashboard endpoint must expose complete peer-management matrix rows.');
  assert(managerDashboard.changeFlow?.rows?.some((row) => row.sourceChannelId === 'google_chat' && row.teamSyncCount > 0), 'Backend manager dashboard endpoint must expose Google Chat change flow proof.');
  assert(managerDashboard.changeFlow?.rows?.some((row) => row.ownerWorkStarted && row.ownerWorkTimelineLogIds?.length > 0), 'Backend manager dashboard endpoint must expose owner first-work proof for feature changes.');
  assert(managerDashboard.changeSourceIntake?.rows?.some((row) => row.sourceChannelCount > 1 && row.channelId === 'google_chat' && row.sourceMessageId) && typeof managerDashboard.changeSourceIntake.sourceReadyCount === 'number', 'Backend manager dashboard endpoint must expose channel-level source intake proof for dual-channel changes.');
  assert(managerDashboard.agentCommunicationFlow?.rows?.some((row) => /manager-ui-agent-message-proof/i.test(row.text || '') && row.inboxSeen && row.senderWorklogSeen), 'Backend manager dashboard endpoint must expose Agent communication flow proof.');
  assert(managerDashboard.agentCommunicationFlow?.deliveryRows?.some((row) => /manager-ui-agent-message-proof/i.test(row.text || '') && row.receiptSeen && row.inboxSeen), 'Backend manager dashboard endpoint must expose per-target Agent message delivery proof.');
  assert(managerDashboard.operationsBoard?.agents?.some((agent) => agent.agentId === 'turing' && agent.dashboardPath?.endsWith('/agents/turing/dashboard')), 'Backend manager dashboard must link Agent rows to per-Agent dashboard resources.');
  const agentDashboard = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/agents/turing/dashboard`).then((response) => response.json());
  assert(agentDashboard.agentId === 'turing' && agentDashboard.ownedTasks?.length > 0 && agentDashboard.worklog?.length > 0, 'Backend per-Agent dashboard endpoint must expose owned tasks and private worklog evidence.');
  assert(agentDashboard.latestWorker?.trigger && agentDashboard.proof?.timelineLogIds?.length > 0, 'Backend per-Agent dashboard endpoint must expose latest worker and timeline proof.');
  assert(agentDashboard.workerLedger?.some((record) => record.trigger === 'manager-ui-management-sync' && record.cadence === 'management-sync') && agentDashboard.proof?.managementProofLogIds?.length > 0, 'Backend per-Agent dashboard endpoint must expose management-sync worker proof.');

  await page.evaluate(() => {
    [...document.querySelectorAll('.overflow-y-auto')].forEach((element) => {
      element.scrollTop = 0;
    });
  });
  await page.getByText('Workspace Hub', { exact: false }).click();
  await assertPageContains(page, 'ACTIVE PROJECTS', 'Workspace dashboard must be reachable before starting a real initiation.');
  await page.getByTestId('start-initiation-button').click();
  await assertPageContains(page, 'Project Initiation Flow', 'Manager must be able to open the real initiation flow.');
  await page.getByTestId('initiation-next-invite').click();
  await page.getByTestId('initiation-next-lobby').click();
  await page.getByTestId('initiation-start-meeting').click();
  await assertPageContains(page, 'INITIATION ROUNDTABLE', 'Initiation flow must reach the kickoff meeting step.');
  await page.getByTestId('initiation-meeting-session-proof').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Backend Meeting Session', 'Initiation meeting must create a durable backend meeting session before approval.');
  await page.getByTestId('initiation-meeting-director-clarification').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('initiation-meeting-role-question-list').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'WAITING', 'Initiation meeting must show unresolved Agent role questions before manager clarification.');
  await page.getByTestId('initiation-meeting-clarification-input').fill('Manager clarified during kickoff: Turing owns backend proof and Curie reviews evidence before approval.');
  await page.getByTestId('initiation-meeting-save-clarification').click();
  await assertPageContains(page, '1 DIRECTOR CLARIFICATION', 'Initiation meeting must let the manager answer Agent role questions before approval.');
  await assertPageContains(page, 'ROLE QUESTIONS ANSWERED', 'Initiation meeting must show answered role-question counts after clarification.');
  await page.getByTestId('initiation-meeting-leader-slate').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('initiation-meeting-leader-candidate-turing').click();
  await assertPageContains(page, 'MANAGER CONFIRMED IN MEETING', 'Manager must be able to confirm the Leader during the campaign stage.');
  await page.getByTestId('initiation-meeting-leader-resolution').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'LEADER RESOLUTION:', 'Initiation meeting must expose persisted Leader election resolution state.');
  await page.getByTestId('initiation-meeting-next-actions').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('initiation-meeting-next-action-0').fill('Manager decided in-meeting execution packet');
  await page.getByTestId('initiation-meeting-save-next-actions').click();
  await page.getByTestId('initiation-meeting-next-action-resolution').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'NEXT ACTION RESOLUTION:', 'Initiation meeting must expose persisted next-action resolution state.');
  await assertPageContains(page, 'MANAGER-CONFIRMED', 'Manager must be able to confirm next actions during the meeting.');
  await page.getByTestId('initiation-meeting-confirmed-team').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, '4 confirmed Agents', 'Initiation meeting must show the confirmed team count before manager edits.');
  await page.getByTestId('initiation-meeting-confirmed-team-confucius').click();
  await assertPageContains(page, 'Removed after meeting', 'Manager must be able to remove an invited Agent from the confirmed project team during the meeting.');
  await page.getByTestId('initiation-finish-meeting').click();
  await assertPageContains(page, 'Director Decisions', 'Initiation result must expose Director decision controls before approval.');
  await page.getByTestId('initiation-result-session-proof').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Meeting Session Evidence', 'Initiation result must expose saved meeting-session evidence before approval.');
  await assertPageContains(page, 'Confirmed Team', 'Initiation result must expose confirmed team roster.');
  await assertPageContains(page, 'Confirmed Leader Marker', 'Initiation result must expose confirmed Leader marker.');
  await assertPageContains(page, 'First Execution Plan', 'Initiation result must expose the first execution plan.');
  await assertPageContains(page, '3 confirmed Agents', 'Initiation result must preserve the team decision made during the meeting.');
  assert(await page.getByTestId('initiation-next-action-0').inputValue() === 'Manager decided in-meeting execution packet', 'Result page must preserve next actions decided during the meeting.');
  await assertPageContains(page, 'Director selected', 'Manager must be able to override the recommended Leader before approval.');
  await page.getByTestId('initiation-approve-create').click();
  await page.waitForFunction(() => document.body.innerText.includes('Roundtable Initiation System') && document.body.innerText.includes('PROJECT DASHBOARD'), null, { timeout: 30000 });
  await assertPageContains(page, 'NEXT ACTION RESOLUTION', 'Approved project dashboard must show the meeting-confirmed next-action resolution.');
  await assertPageContains(page, 'AGENT RECEIPTS:', 'Approved project dashboard must show Agent receipt coverage for the next-action decision.');
  await page.getByTestId('kickoff-dashboard-generation-source').scrollIntoViewIfNeeded({ timeout: 10000 });
  await page.getByTestId('kickoff-dashboard-generation-source').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Kickoff Generation Source', 'Approved real project dashboard must expose kickoff generation provenance after approval.');
  await assertPageContains(page, 'validation fallback', 'Approved real project dashboard must label deterministic kickoff generation instead of presenting it as provider-backed production output.');
  await assertPageContains(page, 'blocked', 'Approved real project dashboard must keep kickoff production claims blocked until provider controls exist.');
  await page.getByTestId('backend-save-project').waitFor({ state: 'attached', timeout: 5000 });
  assert(await page.getByTestId('backend-save-project').isDisabled(), 'Approved real backend projects must keep browser snapshot Seed Sample/Dev disabled; state changes must use backend receipt routes.');

  const initiationSnapshot = await fetch(`${backendRuntime.url}/snapshot`).then((response) => response.json());
  const initiatedProject = initiationSnapshot.projects.find((project) => project.id === 'p_roundtable_001');
  const initiatedMeetingSession = initiationSnapshot.kickoffMeetings?.find((meeting) => meeting.id === 'meeting_p_roundtable_001');
  assert(initiatedProject, 'Backend-connected initiation approval must persist the new project to the backend store.');
  assert(initiatedMeetingSession?.status === 'approved' && initiatedMeetingSession.approvedProjectId === 'p_roundtable_001', 'Backend-connected initiation must persist the approved kickoff meeting session and project link.');
  assert(initiatedProject.productTeamMissionRuns?.some((run) => run.schemaVersion === 'product-team-mission-run/v1' && run.reusedKickoffMeeting === true && run.kickoffMeetingId === 'meeting_p_roundtable_001' && run.researchOnly === false), 'Backend-connected initiation approval must create a generic Product Team Mission Runner receipt from the existing kickoff meeting.');
  assert(initiatedProject.productTeamMissionRuns?.some((run) => run.autonomousSessionId && run.autonomousSessionTickId && run.readRoutes?.productTeamOperatingLoop?.endsWith('/product-team-operating-loop') && run.readRoutes?.runtimeAutonomyStatus?.endsWith('/runtime-autonomy-status')), 'Product Team Mission Runner approval must link the C-side project start to Autopilot, product-team operating-loop, and Runtime Autonomy Status routes.');
  assert(initiatedMeetingSession.evidence?.roleTranscriptIds?.length > 0 && initiatedMeetingSession.evidence?.leaderCampaignIds?.length > 0, 'Backend-connected kickoff meeting session must persist role and Leader campaign transcript evidence.');
  assert(initiatedMeetingSession.leaderElectionResolution?.managerConfirmed && initiatedMeetingSession.leaderElectionResolution?.selectedLeaderId === 'turing', 'Backend-connected kickoff meeting session must persist manager-confirmed Leader election resolution.');
  assert(initiatedMeetingSession.nextActionResolution?.managerConfirmed && initiatedMeetingSession.nextActionResolution?.tasks?.some((task) => /manager decided in-meeting execution packet/i.test(task.text || '')), 'Backend-connected kickoff meeting session must persist manager-confirmed next-action resolution.');
  assert(initiatedMeetingSession.managerClarifications?.some((turn) => /Turing owns backend proof/i.test(turn.text || '')), 'Backend-connected kickoff meeting session must persist manager clarification turns.');
  assert(initiatedMeetingSession.roleQuestionResolutions?.some((row) => row.answered && /Turing owns backend proof/i.test(row.answerText || '')), 'Backend-connected kickoff meeting session must persist answered role-question resolution state.');
  assert(initiatedProject.initiation?.managerClarifications?.some((turn) => /Turing owns backend proof/i.test(turn.text || '')), 'Backend-connected initiation approval must carry manager clarifications into the created project.');
  assert(initiatedProject.initiation?.roleQuestionResolutions?.some((row) => row.answered && row.answerIds?.length > 0), 'Backend-connected initiation approval must carry answered role-question resolution rows into the project.');
  assert(initiatedProject.initiation?.leaderElectionResolution?.managerConfirmed && initiatedProject.initiation?.leaderElectionResolution?.leaderMarkerPersisted, 'Backend-connected initiation approval must carry confirmed Leader election resolution into the project.');
  assert(initiatedProject.initiation?.nextActionResolution?.managerConfirmed && initiatedProject.initiation?.nextActionResolution?.tasks?.some((task) => /manager decided in-meeting execution packet/i.test(task.text || '')), 'Backend-connected initiation approval must carry confirmed next-action resolution into the project.');
  assert(initiatedProject.initiation?.generationProvenance?.schemaVersion === 'kickoff-generation-provenance/v1' && initiatedProject.initiation.generationProvenance.productionClaim === 'blocked', 'Backend-connected initiation approval must carry kickoff generation provenance into the formal project.');
  const initiatedManagerDashboard = await fetch(`${backendRuntime.url}/projects/p_roundtable_001/manager-dashboard`).then((response) => response.json());
  assert(initiatedManagerDashboard.kickoffMeetingFlow?.generationProvenance?.schemaVersion === 'kickoff-generation-provenance/v1' && initiatedManagerDashboard.kickoffMeetingFlow.generationProvenance.productionClaim === 'blocked', 'Backend Manager Dashboard must preserve kickoff generation provenance after real project approval.');
  assert(initiatedProject.team?.every((agent) => initiatedProject.agentStates?.[agent.id]?.inbox?.some((item) => item.sourceMessageId === 'decision_p_roundtable_001_next_actions')), 'Backend-connected initiation approval must deliver next-action decision into every Agent inbox.');
  assert(initiatedProject.team?.every((agent) => initiatedProject.agentStates?.[agent.id]?.obligations?.some((item) => item.sourceMessageId === 'decision_p_roundtable_001_next_actions')), 'Backend-connected initiation approval must create next-action obligations for every Agent.');
  assert(initiatedProject.eventLedger?.some((event) => event.type === 'kickoff-director-clarification'), 'Backend-connected initiation approval must persist manager clarification in the event ledger.');
  assert(initiatedProject.eventLedger?.some((event) => event.type === 'kickoff-next-action-resolution'), 'Backend-connected initiation approval must persist next-action resolution in the event ledger.');
  assert(!initiatedProject.team?.some((agent) => agent.id === 'confucius'), 'Backend-connected initiation must persist the manager-confirmed team, not every invited Agent.');
  assert(!initiatedMeetingSession.managerDecision?.selectedTeamIds?.includes('confucius'), 'Approved kickoff meeting session must persist the manager-edited confirmed team ids.');
  assert(initiatedProject.kickoffCharter?.team?.length === initiatedProject.team?.length, 'Kickoff charter team must match the manager-confirmed project team.');
  assert(initiatedProject.kickoffCharter?.governance?.leaderId === 'turing', 'Backend-connected initiation must persist the Director-selected Leader.');
  assert(initiatedProject.team?.find((agent) => agent.id === 'turing')?.isLeader, 'Backend-connected initiation must persist the Leader marker on the selected Agent.');
  assert(initiatedProject.tasks?.some((task) => /manager decided in-meeting execution packet/i.test(task.text || '')), 'Backend-connected initiation must persist manager-edited first execution tasks.');
  assert(initiatedProject.kickoffCharter?.nextActions?.some((action) => /manager decided in-meeting execution packet/i.test(action.text || '')), 'Backend-connected initiation must carry manager-edited next actions into the kickoff charter.');
  assert(initiatedProject.kickoffCharter?.nextActionResolution?.managerConfirmed, 'Backend-connected initiation must carry next-action resolution into the kickoff charter.');
  assert(initiatedProject.eventLedger?.some((event) => event.type === 'kickoff-role-question'), 'Backend-connected initiation must persist kickoff meeting ledger evidence.');
  assert(initiationSnapshot.messages.some((message) => message.projectId === 'p_roundtable_001' && message.time === 'First Pulse'), 'Backend-connected initiation must persist first autonomous pulse chat evidence.');

  const initiatedProjectId = 'p_roundtable_001';
  await withSuppressedBackendFlowGraph(page, { backendUrl: backendRuntime.url, projectId: initiatedProjectId }, async () => {
    await page.getByRole('button', { name: /Open Flow Graph/i }).click();
    await page.getByTestId('manager-flow-graph').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByRole('button', { name: /Sync Graph/i }).click();
    await page.getByTestId('manager-flow-backend-required').waitFor({ state: 'visible', timeout: 10000 });
    const flowSourceLabel = (await page.getByTestId('manager-flow-source-label').textContent()) || '';
    assert(/backend model missing/i.test(flowSourceLabel), 'Real backend project Flow Graph must label missing backend read models instead of falling back to frontend nodes.');
    const fallbackNodeCount = await page.locator('[data-testid^="manager-flow-node-"]').count();
    assert(fallbackNodeCount === 0, 'Real backend project Flow Graph must not render frontend-generated fallback nodes when the backend read model is missing.');
    await assertPageContains(page, 'frontend-generated flow nodes are suppressed', 'Real backend project Flow Graph must explain that frontend-generated nodes are suppressed.');
    await backToDashboard(page);
  });
  await scrollDashboardToBottom(page);
  if (await page.getByTestId('agent-workbench-turing').count() === 0) {
    await page.getByTestId('agent-focus-open-turing').click();
  }
  await page.getByTestId('agent-workbench-turing').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('agent-workbench-artifact-type-turing').selectOption('brainstorm-board');
  await page.getByTestId('agent-workbench-title-turing').fill('Real project brainstorm board');
  await page.getByTestId('agent-workbench-query-turing').fill('Real initiated project reviewer validation');
  await page.getByTestId('agent-workbench-source-url-turing').fill('https://example.com/real-project-review-proof');
  await page.getByTestId('agent-workbench-instruction-turing').fill('Create a generic product-team draft using brainstorm and evidence nodes.');
  await page.getByTestId('agent-workbench-summary-turing').fill('Brainstorm alternatives for the real initiated project without using a research-only workflow.');
  await page.getByTestId('agent-workbench-body-turing').fill([
    '# Real project brainstorm board',
    '',
    '- Evidence-first product brief with Curie review gates.',
    '- Flow Graph proof packet with revision closure.',
    '- Final deliverable acceptance path for a generic product-team workflow.',
  ].join('\n'));
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="agent-workbench-submit-turing"]');
    return button && !button.disabled;
  }, null, { timeout: 15000 });
  await page.getByTestId('agent-workbench-submit-turing').click();
  await page.getByTestId('agent-workbench-receipt-turing').waitFor({ state: 'visible', timeout: 15000 });
  const realBrainstormSnapshot = await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.id === initiatedProjectId);
      return Boolean(project?.agentSubmissions?.some((submission) => (
        submission.agentId === 'turing'
        && submission.artifactType === 'brainstorm-board'
        && /Real project brainstorm board/i.test(submission.title || '')
        && submission.messageId
        && submission.timelineLogId
        && submission.eventId
      )));
    },
    'Real initiated project Agent Workbench must persist a backend brainstorm-board submission.',
    { timeoutMs: 20000 },
  );
  const realProjectAfterBrainstorm = realBrainstormSnapshot.projects.find((item) => item.id === initiatedProjectId);
  const realBrainstormSubmission = realProjectAfterBrainstorm?.agentSubmissions?.find((submission) => (
    submission.agentId === 'turing'
    && submission.artifactType === 'brainstorm-board'
    && /Real project brainstorm board/i.test(submission.title || '')
  ));
  assert(realBrainstormSubmission?.messageId && realBrainstormSubmission.timelineLogId && realBrainstormSubmission.eventId, 'Real brainstorm-board submission must persist chat, timeline, and event proof.');

  const realBrainstormLayer = await fetch(`${backendRuntime.url}/projects/${initiatedProjectId}/brainstorm-layer`).then((response) => response.json());
  assert(realBrainstormLayer.brainstormLayer?.rows?.some((row) => row.submissionId === realBrainstormSubmission.id && row.alternativeCount >= 3), 'Real brainstorm layer must expose the browser-submitted brainstorm alternatives.');
  const realBrainstormProofMap = await fetch(`${backendRuntime.url}/projects/${initiatedProjectId}/readiness-proof-map`).then((response) => response.json());
  assert(realBrainstormProofMap.brainstormLayerRoutes?.some((route) => route.proofIds?.includes(realBrainstormSubmission.messageId)), 'Readiness Proof Map must route the real brainstorm-board proof.');

  await page.getByTestId('agent-workbench-query-turing').fill('Real project evidence route validation');
  await page.getByTestId('agent-workbench-source-url-turing').fill('https://example.com/real-project-evidence-route');
  await page.getByTestId('agent-workbench-summary-turing').fill('Evidence search proving the real initiated project has source-backed review context.');
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="agent-workbench-evidence-turing"]');
    return button && !button.disabled;
  }, null, { timeout: 15000 });
  await page.getByTestId('agent-workbench-evidence-turing').click();
  await page.getByTestId('agent-workbench-receipt-turing').waitFor({ state: 'visible', timeout: 15000 });
  const realEvidenceSnapshot = await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.id === initiatedProjectId);
      return Boolean(project?.evidenceSearches?.some((record) => (
        record.agentId === 'turing'
        && /Real project evidence route validation/i.test(record.query || '')
        && record.messageId
        && record.timelineLogId
        && record.eventId
        && (record.sources || []).length > 0
      )));
    },
    'Real initiated project Agent Workbench must persist backend evidence search proof.',
    { timeoutMs: 20000 },
  );
  const realProjectAfterEvidence = realEvidenceSnapshot.projects.find((item) => item.id === initiatedProjectId);
  const realEvidenceSearch = realProjectAfterEvidence?.evidenceSearches?.find((record) => (
    record.agentId === 'turing'
    && /Real project evidence route validation/i.test(record.query || '')
  ));
  assert(realEvidenceSearch?.messageId && realEvidenceSearch.timelineLogId && realEvidenceSearch.eventId, 'Real evidence search must persist chat, timeline, and event proof.');
  assert(['manual-source-record', 'deterministic-provider', 'http-json-provider', 'provider-search'].includes(realEvidenceSearch.searchMode) && !realEvidenceSearch.sources?.some((source) => source.kind === 'agent-note'), 'Real Agent Workbench evidence must either be provider-backed or an explicit manual source record, never an agent-note fallback.');
  const realEvidenceProofMap = await fetch(`${backendRuntime.url}/projects/${initiatedProjectId}/readiness-proof-map`).then((response) => response.json());
  assert(realEvidenceProofMap.evidenceSearchRoutes?.some((route) => route.apiPath?.endsWith(`/evidence-searches/${realEvidenceSearch.id}`) && route.proofIds?.includes(realEvidenceSearch.messageId)), 'Readiness Proof Map must route the real evidence-search proof.');

  await page.getByTestId('agent-workbench-artifact-type-turing').selectOption('product-brief');
  await page.getByTestId('agent-workbench-instruction-turing').fill('Draft a product brief from the real brainstorm and evidence nodes for Curie review.');
  await page.getByTestId('agent-workbench-summary-turing').fill('Draft product brief generated from brainstorm and evidence context for Manager-side review.');
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="agent-workbench-draft-submit-turing"]');
    return button && !button.disabled;
  }, null, { timeout: 15000 });
  await page.getByTestId('agent-workbench-draft-submit-turing').click();
  await page.getByTestId('agent-workbench-receipt-turing').waitFor({ state: 'visible', timeout: 20000 });
  const realSubmissionSnapshot = await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.id === initiatedProjectId);
      return Boolean(project?.agentSubmissions?.some((submission) => (
        submission.agentId === 'turing'
        && submission.artifactType === 'product-brief'
        && (submission.isGeneratedDraft || submission.artifactDraft)
        && submission.messageId
        && submission.timelineLogId
        && submission.eventId
      )));
    },
    'Real initiated project Agent Workbench must submit a generated product-brief draft.',
    { timeoutMs: 30000 },
  );
  const realProjectAfterSubmission = realSubmissionSnapshot.projects.find((item) => item.id === initiatedProjectId);
  const realSubmission = realProjectAfterSubmission?.agentSubmissions?.find((submission) => (
    submission.agentId === 'turing'
    && submission.artifactType === 'product-brief'
    && (submission.isGeneratedDraft || submission.artifactDraft)
  ));
  assert(realSubmission?.messageId && realSubmission.timelineLogId && realSubmission.eventId, 'Real generated product-brief submission must persist chat, timeline, and event proof.');
  assert(realSubmission.artifactDraftQuality?.readyForLocalPilot || realSubmission.artifactDraftQualityStatus === 'local-quality-ready', 'Real generated product-brief draft must carry local artifact-draft quality proof.');
  assert(realSubmission.artifactDraft?.proofContext?.evidenceSearchIds?.includes(realEvidenceSearch.id) || realSubmission.artifactDraft?.sourceRefs?.length > 0, 'Real generated product-brief draft must link the evidence search context.');
  assert(realSubmission.readModelRoutes?.managerFlowGraph?.endsWith('/manager-flow-graph') || realSubmission.evidenceIds?.length > 0, 'Real generated product-brief submission must carry route or evidence proof for read-model refresh.');

  await scrollDashboardToBottom(page);
  await station.getByRole('button', { name: /Sync Manager View/i }).click();
  await page.getByTestId('backend-manager-submissions-snapshot').waitFor({ state: 'visible', timeout: 15000 });
  await page.getByTestId(`submission-chat-proof-${realSubmission.id}`).waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId(`submission-timeline-proof-${realSubmission.id}`).waitFor({ state: 'visible', timeout: 10000 });
  await station.getByRole('button', { name: /Check/i }).click();
  await station.getByText('Online', { exact: true }).waitFor({ state: 'visible', timeout: 8000 });
  await assertPageContains(page, 'Submission chat proof', 'Manager Dashboard must expose a direct chat proof exit for real Agent submissions.');
  await assertPageContains(page, 'Submission timeline proof', 'Manager Dashboard must expose a direct timeline proof exit for real Agent submissions.');
  await withSuppressedBackendTranscriptProof(page, {
    backendUrl: backendRuntime.url,
    projectId: initiatedProjectId,
    channelId: realSubmission.channelId || 'main',
  }, async () => {
    await page.getByTestId(`submission-chat-proof-${realSubmission.id}`).click();
    await page.getByTestId('backend-proof-transcript-required').waitFor({ state: 'visible', timeout: 8000 });
    await assertPageContains(page, 'Backend proof transcript required', 'Backend-online proof navigation must show a backend-required transcript state when the backend transcript omits the proof.');
    await page.getByTestId('project-dashboard-view').waitFor({ state: 'visible', timeout: 5000 });
  });
  await scrollDashboardToBottom(page);
  await station.getByRole('button', { name: /Sync Manager View/i }).click();
  await page.getByTestId('backend-manager-submissions-snapshot').waitFor({ state: 'visible', timeout: 15000 });
  await page.getByTestId(`submission-review-composer-${realSubmission.id}`).waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId(`submission-review-reviewer-${realSubmission.id}`).selectOption('curie');
  await page.getByTestId(`submission-review-verdict-${realSubmission.id}`).selectOption('changes-requested');
  await page.getByTestId(`submission-review-comments-${realSubmission.id}`).fill('Curie requests clearer evidence routing before acceptance.');
  await page.getByTestId(`submission-review-requested-changes-${realSubmission.id}`).fill('Add evidence proof route\nSubmit revision note with decision tradeoffs');
  await page.getByTestId(`submission-review-submit-${realSubmission.id}`).click();
  await page.getByTestId(`submission-review-receipt-${realSubmission.id}`).waitFor({ state: 'visible', timeout: 15000 });
  const realReviewSnapshot = await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.id === initiatedProjectId);
      const review = project?.submissionReviews?.find((item) => (
        item.submissionId === realSubmission.id
        && item.reviewerAgentId === 'curie'
        && item.verdict === 'changes-requested'
        && /clearer evidence routing/i.test(item.comments || '')
      ));
      const reviewedSubmission = project?.agentSubmissions?.find((submission) => submission.id === realSubmission.id);
      return Boolean(
        project
        && review
        && reviewedSubmission?.reviewStatus === 'changes-requested'
        && project.agentStates?.turing?.obligations?.some((item) => item.reviewId === review.id && item.status === 'open')
        && project.agentStates?.turing?.inbox?.some((item) => item.reviewId === review.id && item.status === 'changes-requested')
        && project.agentStates?.curie?.worklog?.some((item) => item.reviewId === review.id && item.kind === 'submission-review')
        && snapshot.messages.some((message) => message.projectId === initiatedProjectId && message.type === 'submission-review' && message.reviewId === review.id)
        && project.logs?.some((log) => log.eventType === 'submission-review' && log.reviewId === review.id)
        && project.eventLedger?.some((event) => event.type === 'submission-review' && event.entityIds?.reviewId === review.id)
      );
    },
    'Real initiated project Reviewer decision must persist review proof and route obligations back to the submitter.',
    { timeoutMs: 20000 },
  );
  const realProjectAfterReview = realReviewSnapshot.projects.find((item) => item.id === initiatedProjectId);
  const realReview = realProjectAfterReview?.submissionReviews?.find((review) => (
    review.submissionId === realSubmission.id
    && review.reviewerAgentId === 'curie'
    && review.verdict === 'changes-requested'
  ));
  assert(realReview?.messageId && realReview.timelineLogId && realReview.eventId, 'Real initiated project Reviewer decision must carry chat, timeline, and event proof ids.');
  await page.getByTestId('backend-manager-submission-reviews-snapshot').waitFor({ state: 'visible', timeout: 15000 });
  await assertPageContains(page, 'Curie requests clearer evidence routing', 'Manager Dashboard must render the real backend Reviewer decision.');

  const realManagerDashboard = await fetch(`${backendRuntime.url}/projects/${initiatedProjectId}/manager-dashboard`).then((response) => response.json());
  assert(realManagerDashboard.submissionReviews?.changesRequestedCount >= 1, 'Real manager dashboard read model must count changes-requested Reviewer decisions.');
  assert(realManagerDashboard.submissions?.rows?.some((row) => row.id === realSubmission.id && row.reviewStatus === 'changes-requested'), 'Real manager dashboard read model must reflect the reviewed submission status.');
  const realFlowGraph = await fetch(`${backendRuntime.url}/projects/${initiatedProjectId}/manager-flow-graph`).then((response) => response.json());
  assert(realFlowGraph.nodes?.some((node) => node.id === `agent-submission-${realSubmission.id}`), 'Real manager flow graph must expose the Agent submission node.');
  assert(realFlowGraph.nodes?.some((node) => node.id === `submission-review-${realReview.id}`), 'Real manager flow graph must expose the Reviewer decision node.');
  const realProofMap = await fetch(`${backendRuntime.url}/projects/${initiatedProjectId}/readiness-proof-map`).then((response) => response.json());
  assert(realProofMap.submissionReviewRoutes?.some((route) => route.apiPath?.endsWith(`/submission-reviews/${realReview.id}`) && route.proofIds?.includes(realReview.messageId)), 'Real readiness proof map must route the Reviewer decision proof.');
  const realCurieDashboard = await fetch(`${backendRuntime.url}/projects/${initiatedProjectId}/agents/curie/dashboard`).then((response) => response.json());
  assert(realCurieDashboard.ownedSubmissionReviews?.some((review) => review.id === realReview.id && review.roleInReview === 'reviewer'), 'Reviewer Agent dashboard must expose the real review as Curie work.');
  const realTuringDashboard = await fetch(`${backendRuntime.url}/projects/${initiatedProjectId}/agents/turing/dashboard`).then((response) => response.json());
  assert(realTuringDashboard.ownedSubmissionReviews?.some((review) => review.id === realReview.id && review.roleInReview === 'submitter'), 'Submitter Agent dashboard must expose the review feedback as Turing-owned state.');
  assert(realTuringDashboard.obligations?.some((obligation) => obligation.reviewId === realReview.id && obligation.status === 'open'), 'Submitter Agent dashboard must expose the open revision obligation created by the Reviewer.');

  await page.getByTestId('agent-workbench-turing').scrollIntoViewIfNeeded();
  await page.getByTestId('agent-workbench-artifact-type-turing').selectOption('revision-note');
  await page.waitForFunction((reviewId) => {
    const select = document.querySelector('[data-testid="agent-workbench-review-turing"]');
    return select && [...select.options].some((option) => option.value === reviewId);
  }, realReview.id, { timeout: 15000 });
  await page.getByTestId('agent-workbench-review-turing').selectOption(realReview.id);
  await page.waitForFunction((submissionId) => {
    const select = document.querySelector('[data-testid="agent-workbench-revises-submission-turing"]');
    return select && [...select.options].some((option) => option.value === submissionId);
  }, realSubmission.id, { timeout: 15000 });
  await page.getByTestId('agent-workbench-revises-submission-turing').selectOption(realSubmission.id);
  await page.getByTestId('agent-workbench-title-turing').fill('Real project revision response');
  await page.getByTestId('agent-workbench-summary-turing').fill('Revision note responding to Curie changes-requested review with clearer evidence routing.');
  await page.getByTestId('agent-workbench-body-turing').fill([
    '# Real project revision response',
    '',
    'This revision answers Curie by adding the explicit evidence route and decision tradeoffs.',
    `Responds to review: ${realReview.id}`,
    `Revises submission: ${realSubmission.id}`,
  ].join('\n'));
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="agent-workbench-submit-turing"]');
    return button && !button.disabled;
  }, null, { timeout: 15000 });
  await page.getByTestId('agent-workbench-submit-turing').click();
  const realRevisionSnapshot = await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.id === initiatedProjectId);
      const revision = project?.agentSubmissions?.find((submission) => (
        submission.agentId === 'turing'
        && submission.artifactType === 'revision-note'
        && submission.respondsToReviewId === realReview.id
        && submission.revisesSubmissionId === realSubmission.id
        && /Real project revision response/i.test(submission.title || '')
      ));
      return Boolean(
        project
        && revision?.messageId
        && revision.timelineLogId
        && revision.eventId
        && project.agentStates?.turing?.obligations?.some((item) => item.reviewId === realReview.id && item.status === 'resolved' && item.resolvedBySubmissionId === revision.id)
      );
    },
    'Real initiated project revision note must answer the review and resolve the submitter obligation.',
    { timeoutMs: 20000 },
  );
  const realProjectAfterRevision = realRevisionSnapshot.projects.find((item) => item.id === initiatedProjectId);
  const realRevisionSubmission = realProjectAfterRevision?.agentSubmissions?.find((submission) => (
    submission.agentId === 'turing'
    && submission.artifactType === 'revision-note'
    && submission.respondsToReviewId === realReview.id
    && submission.revisesSubmissionId === realSubmission.id
  ));
  assert(realRevisionSubmission?.messageId && realRevisionSubmission.timelineLogId && realRevisionSubmission.eventId, 'Real revision note must carry chat, timeline, and event proof ids.');

  await page.getByTestId('agent-workbench-artifact-type-turing').selectOption('final-deliverable');
  await page.waitForFunction((reviewId) => {
    const select = document.querySelector('[data-testid="agent-workbench-review-turing"]');
    return select && [...select.options].some((option) => option.value === reviewId);
  }, realReview.id, { timeout: 15000 });
  await page.getByTestId('agent-workbench-review-turing').selectOption(realReview.id);
  await page.waitForFunction((revisionId) => {
    const select = document.querySelector('[data-testid="agent-workbench-revises-submission-turing"]');
    return select && [...select.options].some((option) => option.value === revisionId);
  }, realRevisionSubmission.id, { timeout: 15000 });
  await page.getByTestId('agent-workbench-revises-submission-turing').selectOption(realRevisionSubmission.id);
  await page.getByTestId('agent-workbench-title-turing').fill('Real project final deliverable');
  await page.getByTestId('agent-workbench-summary-turing').fill('Final deliverable produced after the requested revision, ready for Curie acceptance.');
  await page.getByTestId('agent-workbench-body-turing').fill([
    '# Real project final deliverable',
    '',
    'This final deliverable incorporates the requested evidence route and decision tradeoffs.',
    `Responds to review: ${realReview.id}`,
    `Revises revision note: ${realRevisionSubmission.id}`,
  ].join('\n'));
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="agent-workbench-submit-turing"]');
    return button && !button.disabled;
  }, null, { timeout: 15000 });
  await page.getByTestId('agent-workbench-submit-turing').click();
  const realFinalSnapshot = await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.id === initiatedProjectId);
      const finalSubmission = project?.agentSubmissions?.find((submission) => (
        submission.agentId === 'turing'
        && submission.artifactType === 'final-deliverable'
        && submission.status === 'final'
        && submission.respondsToReviewId === realReview.id
        && submission.revisesSubmissionId === realRevisionSubmission.id
        && (submission.supersedesSubmissionIds || []).includes(realSubmission.id)
        && /Real project final deliverable/i.test(submission.title || '')
      ));
      return Boolean(finalSubmission?.messageId && finalSubmission.timelineLogId && finalSubmission.eventId);
    },
    'Real initiated project final deliverable must preserve revision lineage and proof ids.',
    { timeoutMs: 20000 },
  );
  const realProjectAfterFinal = realFinalSnapshot.projects.find((item) => item.id === initiatedProjectId);
  const realFinalSubmission = realProjectAfterFinal?.agentSubmissions?.find((submission) => (
    submission.agentId === 'turing'
    && submission.artifactType === 'final-deliverable'
    && submission.respondsToReviewId === realReview.id
    && submission.revisesSubmissionId === realRevisionSubmission.id
  ));
  assert(realFinalSubmission?.messageId && realFinalSubmission.timelineLogId && realFinalSubmission.eventId, 'Real final deliverable must carry chat, timeline, and event proof ids.');

  await scrollDashboardToBottom(page);
  await station.getByRole('button', { name: /Sync Manager View/i }).click();
  await page.getByTestId(`submission-review-composer-${realFinalSubmission.id}`).waitFor({ state: 'visible', timeout: 15000 });
  await page.getByTestId(`submission-review-reviewer-${realFinalSubmission.id}`).selectOption('curie');
  await page.getByTestId(`submission-review-verdict-${realFinalSubmission.id}`).selectOption('accepted');
  await page.getByTestId(`submission-review-comments-${realFinalSubmission.id}`).fill('Curie accepts the final deliverable after the revision closed the evidence-routing gap.');
  await page.getByTestId(`submission-review-requested-changes-${realFinalSubmission.id}`).fill('');
  await page.getByTestId(`submission-review-submit-${realFinalSubmission.id}`).click();
  await page.getByTestId(`submission-review-receipt-${realFinalSubmission.id}`).waitFor({ state: 'visible', timeout: 15000 });
  const realAcceptedSnapshot = await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.id === initiatedProjectId);
      const acceptedReview = project?.submissionReviews?.find((review) => (
        review.submissionId === realFinalSubmission.id
        && review.reviewerAgentId === 'curie'
        && review.verdict === 'accepted'
        && /accepts the final deliverable/i.test(review.comments || '')
      ));
      const acceptedFinal = project?.agentSubmissions?.find((submission) => submission.id === realFinalSubmission.id);
      return Boolean(
        project
        && acceptedReview?.messageId
        && acceptedReview.timelineLogId
        && acceptedReview.eventId
        && acceptedFinal?.reviewStatus === 'accepted'
        && acceptedFinal.status === 'final'
        && project.logs?.some((log) => log.eventType === 'submission-review' && log.reviewId === acceptedReview.id)
        && project.eventLedger?.some((event) => event.type === 'submission-review' && event.entityIds?.reviewId === acceptedReview.id)
      );
    },
    'Real initiated project final deliverable acceptance must persist review proof and final status.',
    { timeoutMs: 20000 },
  );
  const realProjectAfterAcceptance = realAcceptedSnapshot.projects.find((item) => item.id === initiatedProjectId);
  const realFinalAcceptedReview = realProjectAfterAcceptance?.submissionReviews?.find((review) => (
    review.submissionId === realFinalSubmission.id
    && review.reviewerAgentId === 'curie'
    && review.verdict === 'accepted'
  ));
  assert(realFinalAcceptedReview?.messageId && realFinalAcceptedReview.timelineLogId && realFinalAcceptedReview.eventId, 'Accepted final deliverable review must carry chat, timeline, and event proof ids.');

  const realWorkflow = await fetch(`${backendRuntime.url}/projects/${initiatedProjectId}/submission-review-workflow`).then((response) => response.json());
  const workflowGates = realWorkflow.submissionReviewWorkflow?.gates || [];
  assert(workflowGates.some((gate) => gate.id === 'change-requests-closed-by-revision' && gate.passed), 'Submission review workflow must show the requested-change round closed by revision.');
  assert(workflowGates.some((gate) => gate.id === 'final-deliverable-accepted' && gate.passed), 'Submission review workflow must show the final deliverable accepted.');
  const realClosedFlowGraph = await fetch(`${backendRuntime.url}/projects/${initiatedProjectId}/manager-flow-graph`).then((response) => response.json());
  assert(realClosedFlowGraph.nodes?.some((node) => node.id === `agent-submission-${realRevisionSubmission.id}` && node.subtype === 'revision-note'), 'Flow Graph must expose the revision-note node.');
  assert(realClosedFlowGraph.nodes?.some((node) => node.id === `agent-submission-${realFinalSubmission.id}` && node.subtype === 'final-deliverable'), 'Flow Graph must expose the final-deliverable node.');
  assert(realClosedFlowGraph.nodes?.some((node) => node.id === 'submission-review-workflow' && node.status === 'confirmed'), 'Flow Graph must expose a confirmed submission review workflow closure node.');
  const realClosedProofMap = await fetch(`${backendRuntime.url}/projects/${initiatedProjectId}/readiness-proof-map`).then((response) => response.json());
  assert(realClosedProofMap.revisionRoutes?.some((route) => route.apiPath?.endsWith(`/submissions/${realRevisionSubmission.id}`) && route.respondsToReviewId === realReview.id), 'Readiness Proof Map must expose the revision-note route.');
  assert(realClosedProofMap.submissionRoutes?.some((route) => route.artifactType === 'final-deliverable' && route.proofIds?.includes(realFinalSubmission.messageId)), 'Readiness Proof Map must expose the final-deliverable submission route.');
  assert(realClosedProofMap.submissionReviewRoutes?.some((route) => route.apiPath?.endsWith(`/submission-reviews/${realFinalAcceptedReview.id}`) && route.verdict === 'accepted'), 'Readiness Proof Map must expose the accepted final review route.');
  assert(realClosedProofMap.transcriptProofCoverageSummary?.readyForBackendTranscriptProof === true && realClosedProofMap.transcriptProofCoverageSummary?.missingProofIdCount === 0 && realClosedProofMap.transcriptProofCoverageRoutes?.some((route) => route.apiPath?.endsWith('/transcripts') && route.archivedProofIdCount === route.expectedProofIdCount), 'Readiness Proof Map must prove backend transcript coverage after submission, evidence, review, revision, and final-deliverable closure.');
  assert(realClosedProofMap.productTeamAcceptanceChainSummary?.readyForGenericProductTeamAcceptance === true && realClosedProofMap.productTeamAcceptanceChainSummary?.missingCount === 0, 'Readiness Proof Map must summarize the generic product-team acceptance chain after final deliverable closure.');
  assert(realClosedProofMap.productTeamAcceptanceChainRoutes?.some((route) => route.apiPath?.endsWith('/product-team-delivery-trace') && route.readyForGenericProductTeamAcceptance === true && route.readyForBsideProductTeamRun === true && route.stageRows?.length >= 8 && route.missingStageIds?.length === 0 && route.proofIds?.length && route.timelineLogIds?.length && route.eventIds?.length), 'Readiness Proof Map must expose the generic product-team acceptance chain route with stage, proof, timeline, event, and B-side loop readiness.');
  await scrollDashboardToBottom(page);
  await station.getByRole('button', { name: /Sync Manager View/i }).click();
  await page.getByTestId('group-chat-collaboration-proof-rows').scrollIntoViewIfNeeded();
  await page.getByTestId('group-chat-collaboration-proof-rows').waitFor({ state: 'visible', timeout: 10000 });
  await assertPageContains(page, 'Collaboration Proof Rows', 'Group Chat Transcript Index must expose collaboration proof rows.');
  await assertPageContains(page, 'Agent Submission', 'Group Chat Transcript Index must expose Agent submission proof rows.');
  await assertPageContains(page, 'Submission Review', 'Group Chat Transcript Index must expose Reviewer decision proof rows.');
  await assertPageContains(page, 'Evidence Search', 'Group Chat Transcript Index must expose evidence-search proof rows.');
  await assertPageContains(page, 'Final Deliverable', 'Group Chat Transcript Index must expose final-deliverable proof rows.');
  const evidenceSearchChatProof = page.locator('[data-testid^="transcript-collaboration-proof-chat-evidence-"]').first();
  await evidenceSearchChatProof.waitFor({ state: 'visible', timeout: 10000 });
  await evidenceSearchChatProof.click();
  await assertPageContains(page, 'PROOF FOCUS:', 'Evidence-search collaboration proof row must open transcript evidence.');
  await page.locator('[data-testid^="chat-collaboration-node-evidence-search-"]').first().waitFor({ state: 'visible', timeout: 10000 });
  await assertPageContains(page, 'Evidence Search', 'Live Group Chat must render evidence-search messages as collaboration node cards.');
  await backToDashboard(page);
  await page.getByTestId('group-chat-collaboration-proof-rows').scrollIntoViewIfNeeded();
  const finalDeliverableChatProof = page.locator('[data-testid^="transcript-collaboration-proof-chat-final-deliverable-"]').first();
  await finalDeliverableChatProof.waitFor({ state: 'visible', timeout: 10000 });
  await finalDeliverableChatProof.click();
  await assertPageContains(page, 'PROOF FOCUS:', 'Final-deliverable collaboration proof row must open transcript evidence.');
  const finalDeliverableChatNode = page.locator('[data-testid^="chat-collaboration-node-final-deliverable-"]').first();
  await finalDeliverableChatNode.waitFor({ state: 'visible', timeout: 10000 });
  await assertPageContains(page, 'Final Deliverable', 'Live Group Chat must render final-deliverable messages as collaboration node cards.');
  await finalDeliverableChatNode.getByRole('button', { name: /Flow node/i }).click();
  await page.getByTestId('timeline-node-metadata-detail').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForFunction((nodeId) => {
    const detail = document.querySelector('[data-testid="timeline-node-metadata-detail"]')?.textContent || '';
    return detail.includes(nodeId);
  }, `agent-submission-${realFinalSubmission.id}`, { timeout: 10000 });
  await assertPageContains(page, 'Manager Flow Graph', 'Final-deliverable chat node must jump into Manager Flow Graph.');
  await page.getByTestId('manager-flow-selected-proof-route').waitFor({ state: 'visible', timeout: 10000 });
  await assertPageContains(page, `/projects/${initiatedProjectId}/submissions/${realFinalSubmission.id}`, 'Selected final-deliverable Flow Graph node must expose its backend submission proof route.');
  await assertPageContains(page, 'Coverage: submissionRoutes', 'Selected final-deliverable Flow Graph node must match a Readiness Proof Map route.');
  await page.getByTestId('manager-flow-selected-proof-route-open').click();
  await page.getByTestId('manager-proof-map').waitFor({ state: 'visible', timeout: 10000 });
  await assertPageContains(page, 'Manager Proof Map', 'Flow Graph proof-route action must return the Manager to the Proof Map.');
  await page.getByTestId('group-chat-collaboration-proof-rows').scrollIntoViewIfNeeded();
  const reviewChatProof = page.locator('[data-testid^="transcript-collaboration-proof-chat-review-"]').first();
  await reviewChatProof.waitFor({ state: 'visible', timeout: 10000 });
  await reviewChatProof.click();
  await assertPageContains(page, 'PROOF FOCUS:', 'Submission-review collaboration proof row must open transcript evidence.');
  await page.locator('[data-testid^="chat-collaboration-node-submission-review-"]').first().waitFor({ state: 'visible', timeout: 10000 });
  await assertPageContains(page, 'Submission Review', 'Live Group Chat must render submission-review messages as collaboration node cards.');
  await backToDashboard(page);
  await page.getByTestId('group-chat-collaboration-proof-rows').scrollIntoViewIfNeeded();
  const submissionTimelineProof = page.locator('[data-testid^="transcript-collaboration-proof-timeline-submission-"]').first();
  await submissionTimelineProof.waitFor({ state: 'visible', timeout: 10000 });
  await submissionTimelineProof.click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:', 'Agent-submission collaboration proof row must open timeline evidence.');

  if (CAPTURE_SUCCESS_SCREENSHOT) {
    await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
    await page.screenshot({
      path: fileURLToPath(new URL('../dist/manager-backend-ui-validation.png', import.meta.url)),
      fullPage: true,
    });
  }

  console.log('Manager backend UI validation passed.');
} catch (error) {
  await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
  const page = browser?.contexts?.()[0]?.pages?.()?.[0] || null;
  if (page) {
    await page.screenshot({
      path: fileURLToPath(new URL('../dist/manager-backend-ui-failure.png', import.meta.url)),
      fullPage: true,
    }).catch(() => {});
    const bodyText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
    console.error(`Visible page excerpt:\n${bodyText.slice(0, 1600)}`);
  }
  if (consoleErrors.length) console.error(`Console diagnostics:\n${consoleErrors.join('\n')}`);
  if (pageErrors.length) console.error(`Page errors:\n${pageErrors.join('\n')}`);
  if (walkthroughRequests.length) console.error(`Walkthrough requests:\n${walkthroughRequests.join('\n')}`);
  throw error;
} finally {
  await browser?.close().catch(() => {});
  await backendServer.close().catch(() => {});
  await new Promise((resolve) => staticRuntime.server.close(resolve)).catch(() => {});
  cleanupManagerBackendUiTmp();
}
