import { createServer } from 'node:http';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';

const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const DIST_DIR = join(ROOT_DIR, 'dist');
const RUN_ID = `${process.pid}-${Date.now()}`;
const BACKEND_STORE = new URL(`../.tmp/agent-manager-backend-core-ui-store-${RUN_ID}.json`, import.meta.url);
const LOCAL_AUTH_STORE = new URL(`../.tmp/agent-manager-backend-core-ui-auth-${RUN_ID}.json`, import.meta.url);
const BACKEND_STORAGE_KEY = 'hall_of_fame_studio.agent_backend_url.v1';
const LOCAL_AUTH_STORAGE_KEY = 'hall_of_fame_studio.local_auth_session.v1';
const LANGUAGE_STORAGE_KEY = 'hall_of_fame_studio.language.v1';
const VIEWPORT = { width: 1440, height: 1100 };
const DASHBOARD_RESPONSIVE_VIEWPORTS = [
  { width: 1440, height: 1100 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
  { width: 960, height: 540 },
];
const nativeFetch = globalThis.fetch.bind(globalThis);
let backendAuthContext = null;

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

async function assertDashboardResponsive(page) {
  await page.getByTestId('project-dashboard-view').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('project-overview').waitFor({ state: 'visible', timeout: 10000 });

  for (const viewport of DASHBOARD_RESPONSIVE_VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(150);
    const metrics = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="project-dashboard-view"]');
      const overview = document.querySelector('[data-testid="project-overview"]');
      const paper = overview?.querySelector('.project-paper');
      if (!root || !overview || !paper) return null;
      const rootRect = root.getBoundingClientRect();
      const overviewRect = overview.getBoundingClientRect();
      const paperRect = paper.getBoundingClientRect();
      const overflowElements = Array.from(paper.querySelectorAll('*'))
        .filter((element) => element.offsetParent !== null && element.getClientRects().length > 0)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            name: element.getAttribute('data-testid') || element.tagName.toLowerCase(),
            left: Math.max(0, Math.round(overviewRect.left - rect.left)),
            right: Math.max(0, Math.round(rect.right - overviewRect.right)),
          };
        })
        .filter((row) => row.left > 1 || row.right > 1)
        .sort((left, right) => Math.max(right.left, right.right) - Math.max(left.left, left.right))
        .slice(0, 5);
      return {
        bodyOverflow: Math.max(
          document.body.scrollWidth - document.body.clientWidth,
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
        overviewOverflow: overview.scrollWidth - overview.clientWidth,
        overviewOverflowMode: getComputedStyle(overview).overflowX,
        paperLeftOverflow: Math.max(0, overviewRect.left - paperRect.left),
        paperRightOverflow: Math.max(0, paperRect.right - overviewRect.right),
        rootRightOverflow: Math.max(0, rootRect.right - window.innerWidth),
        rootWidth: rootRect.width,
        overflowElements,
      };
    });
    assert(metrics, `Complete Dashboard did not render at ${viewport.width}x${viewport.height}.`);
    assert(metrics.bodyOverflow <= 1, `Complete Dashboard body has ${metrics.bodyOverflow}px horizontal overflow at ${viewport.width}x${viewport.height}.`);
    const contentContained = metrics.overviewOverflow <= 1 || ['hidden', 'clip'].includes(metrics.overviewOverflowMode);
    assert(contentContained, `Complete Dashboard content has ${metrics.overviewOverflow}px horizontal overflow at ${viewport.width}x${viewport.height}. Elements: ${JSON.stringify(metrics.overflowElements)}.`);
    assert(metrics.paperLeftOverflow <= 1 && metrics.paperRightOverflow <= 1, `Complete Dashboard paper is clipped horizontally at ${viewport.width}x${viewport.height}.`);
    assert(metrics.rootRightOverflow <= 1 && metrics.rootWidth > 0, `Complete Dashboard root is outside the viewport at ${viewport.width}x${viewport.height}.`);
    await page.getByTestId('project-sample-fixture-banner').waitFor({ state: 'visible', timeout: 5000 });
  }

  await page.setViewportSize(VIEWPORT);
  await page.waitForTimeout(150);
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

async function waitForBackendSnapshot(url, predicate, message, { timeoutMs = 15000 } = {}) {
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

async function scrollDashboardToStation(page) {
  await page.getByTestId('backend-worker-station').scrollIntoViewIfNeeded({ timeout: 10000 });
  await page.waitForTimeout(250);
}

async function clickDynamic(locator) {
  try {
    await locator.click({ force: true, timeout: 10000 });
  } catch {
    await locator.dispatchEvent('click');
  }
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
    { channel: 'msedge', headless: true },
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

const backendServer = createAgentProjectHttpServer({
  filePath: BACKEND_STORE,
  localAuthFilePath: LOCAL_AUTH_STORE,
  localAuthRequired: true,
  replaceWithSeed: true,
});
const backendRuntime = await backendServer.listen();
const bootstrapResponse = await fetch(`${backendRuntime.url}/local-auth/bootstrap`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'manager-core-validator', password: 'core1' }),
});
const bootstrapPayload = await bootstrapResponse.json();
assert(bootstrapResponse.status === 201, `Could not create isolated local validation account: ${bootstrapPayload.error || bootstrapResponse.status}.`);
const localAuthSession = { ...bootstrapPayload.localAuth, baseUrl: backendRuntime.url };
backendAuthContext = { baseUrl: backendRuntime.url, token: localAuthSession.token };
const staticRuntime = configuredUiBaseUrl
  ? await resolveExternalUiRuntime(configuredUiBaseUrl)
  : await listen(createStaticServer());
let browser = null;
const backendResponses = [];
const backendRequests = [];
const consoleDiagnostics = [];

const managerDemoProjectPutCount = () => backendResponses.filter((entry) => (
  /\sPUT\s/.test(entry)
  && /\/projects\/p_manager_demo_001(?:\?|$|\/?$)/i.test(entry)
)).length;

try {
  browser = await launchBrowserWithRetry();
  const context = await browser.newContext({ viewport: VIEWPORT });
  await context.addInitScript(({ backendUrl, storageKey, authStorageKey, languageStorageKey, authSession }) => {
    window.__AGENT_BACKEND_URL__ = backendUrl;
    window.localStorage.setItem(storageKey, JSON.stringify(backendUrl));
    window.localStorage.setItem(languageStorageKey, 'en');
    window.sessionStorage.setItem(authStorageKey, JSON.stringify(authSession));
  }, {
    backendUrl: backendRuntime.url,
    storageKey: BACKEND_STORAGE_KEY,
    authStorageKey: LOCAL_AUTH_STORAGE_KEY,
    languageStorageKey: LANGUAGE_STORAGE_KEY,
    authSession: localAuthSession,
  });

  const page = await context.newPage();
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleDiagnostics.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleDiagnostics.push(`pageerror: ${error.stack || error.message}`);
  });
  page.on('response', async (response) => {
    if (/\/(projects|workers)\//.test(response.url())) {
      const detail = response.status() >= 400 ? await response.text().catch(() => '') : '';
      backendResponses.push(`${response.status()} ${response.request().method()} ${response.url()}${detail ? ` ${detail}` : ''}`);
    }
  });
  page.on('request', (request) => {
    if (/\/(projects|workers)\//.test(request.url())) {
      backendRequests.push(`${new Date().toISOString()} ${request.method()} ${request.url()}`);
    }
  });

  await page.goto(staticRuntime.url, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Workspace Hub/i }).click();
  await page.getByTestId('workspace-open-advanced').click();
  await page.getByTestId('manager-demo-tools').click();
  await page.getByRole('button', { name: /Load Sample Fixture.*Manager demo data/i }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Manager Demo: Autonomous Agent Studio'), null, { timeout: 10000 });
  await page.getByTestId('project-sample-fixture-banner').waitFor({ state: 'visible', timeout: 5000 });
  await assertDashboardResponsive(page);

  await scrollDashboardToStation(page);
  const station = page.getByTestId('backend-worker-station');
  await station.getByRole('button', { name: /Check/i }).click();
  await station.getByText('Online', { exact: true }).waitFor({ state: 'visible', timeout: 8000 });
  await page.getByTestId('backend-sync-ready-package').click();
  await page.getByTestId('backend-manager-ready-package-snapshot').waitFor({ state: 'visible', timeout: 15000 });
  const managerReadyPackageSummary = page.getByTestId('backend-manager-ready-package-summary');
  await managerReadyPackageSummary.waitFor({ state: 'visible', timeout: 15000 });
  const managerReadyPackageText = await managerReadyPackageSummary.innerText();
  for (const summaryLabel of ['Pilot Launch', 'Evidence Archive', 'Intent Queue', 'Runtime Contracts', 'Transcript Channels']) {
    assert(managerReadyPackageText.toLowerCase().includes(summaryLabel.toLowerCase()), `Manager Ready Package summary must render ${summaryLabel}.`);
  }
  for (const sourceTestId of [
    'backend-product-team-operating-loop-source',
    'backend-planner-executor-reviewer-state-machine-source',
    'backend-team-collaboration-diagnostics-source',
    'backend-runtime-contracts-source',
    'backend-autonomous-cycle-consistency-source',
    'backend-runtime-autonomy-status-source',
    'backend-zero-to-autonomy-report-source',
    'backend-product-team-delivery-trace-source',
    'backend-project-evidence-archive-source',
    'backend-brainstorm-layer-source',
    'backend-artifact-quality-audit-source',
    'backend-submission-review-workflow-source',
    'backend-evidence-quality-audit-source',
    'backend-evidence-index-readiness-source',
    'backend-evidence-source-review-workflow-source',
    'backend-private-pilot-go-live-readiness-source',
    'backend-production-infrastructure-rehearsal-source',
    'backend-public-production-startup-readiness-source',
    'backend-production-launch-gap-register-source',
    'backend-production-launch-control-center-source',
    'backend-production-launch-evidence-dossier-source',
    'backend-production-evidence-integrity-audit-source',
    'backend-private-pilot-release-candidate-workflow-source',
    'backend-private-pilot-launch-run-workflow-source',
    'backend-private-pilot-launch-health-check-workflow-source',
    'backend-private-pilot-acceptance-report-workflow-source',
    'backend-launch-approval-workflow-source',
    'backend-operations-readiness-source',
    'backend-provider-readiness-source',
    'backend-provider-controlled-run-source',
    'backend-provider-eval-run-workflow-source',
    'backend-evidence-custody-readiness-source',
    'backend-security-boundary-source',
  ]) {
    const sourceBadge = page.getByTestId(sourceTestId);
    await sourceBadge.waitFor({ state: 'visible', timeout: 15000 });
    assert((await sourceBadge.innerText()).trim().length > 0, `${sourceTestId} must render its backend source label.`);
  }
  for (const panelTestId of [
    'backend-manager-dashboard-snapshot',
    'backend-transcript-proof-coverage-snapshot',
    'backend-manager-submissions-route',
    'backend-manager-command-center-route',
    'backend-manager-command-center-snapshot',
    'backend-manager-action-queue-snapshot',
    'backend-private-pilot-release-candidate-workflow-snapshot',
    'backend-private-pilot-launch-run-workflow-snapshot',
    'backend-private-pilot-launch-health-check-workflow-snapshot',
    'backend-private-pilot-acceptance-report-workflow-snapshot',
    'backend-production-operations-readiness-snapshot',
    'backend-production-operations-control-receipts-snapshot',
    'backend-production-deployment-control-receipts-snapshot',
    'backend-production-security-control-receipts-snapshot',
    'backend-production-provider-control-receipts-snapshot',
    'backend-production-launch-audit-snapshot',
    'backend-launch-approval-workflow-snapshot',
    'backend-pilot-launch-readiness-snapshot',
    'backend-deployment-preflight-snapshot',
    'backend-mvp-readiness-snapshot',
    'backend-operations-readiness-snapshot',
    'backend-provider-readiness-snapshot',
    'backend-provider-controlled-run-snapshot',
    'backend-provider-eval-run-workflow-snapshot',
    'backend-evidence-custody-readiness-snapshot',
    'backend-security-boundary-snapshot',
  ]) {
    await page.getByTestId(panelTestId).waitFor({ state: 'visible', timeout: 15000 });
  }
  const publicStartupReadinessCard = page.getByTestId('backend-public-production-startup-readiness-snapshot');
  await publicStartupReadinessCard.waitFor({ state: 'visible', timeout: 10000 });
  const publicStartupReadinessText = await publicStartupReadinessCard.innerText();
  assert(/public production startup readiness/i.test(publicStartupReadinessText), 'Manager Ready Package must render the public production startup readiness panel.');
  assert(publicStartupReadinessText.toLowerCase().includes('public blocked'), 'Manager Ready Package must show public production startup as blocked until managed production controls exist.');
  assert(publicStartupReadinessText.toLowerCase().includes('/public-production-startup-readiness'), 'Manager Ready Package must expose the public production startup readiness route.');
  const managerReadyPackage = await fetch(`${backendRuntime.url}/projects/p_manager_demo_001/manager-ready-package`).then((response) => response.json());
  assert(managerReadyPackage.publicProductionStartupReadiness?.schemaVersion === 'public-production-startup-readiness/v1', 'Backend Manager Ready Package must include the public production startup readiness contract.');
  assert(managerReadyPackage.summary?.publicProductionStartupReady === false, 'Backend Manager Ready Package must keep public production startup readiness blocked.');
  assert(backendResponses.some((entry) => entry.includes('GET') && entry.includes('/projects/p_manager_demo_001/manager-ready-package')), 'Manager Ready Package sync must call the backend manager-ready-package route.');
  const projectToolsButton = page.getByRole('button', { name: /Open project tools/i });
  await clickDynamic(projectToolsButton);
  await page.getByRole('button', { name: /Group Channels/i }).click();
  await page.getByTestId('project-chat-create-transcript-channel').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('project-chat-create-transcript-channel').click();
  const channelSnapshot = await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.id === 'p_manager_demo_001');
      return Boolean(project?.transcriptChannelReceipts?.some((receipt) => (
        receipt.schemaVersion === 'transcript-channel-created/v1'
        && receipt.channelId?.startsWith('room_')
        && receipt.messageId
        && receipt.timelineLogId
        && receipt.eventId
      )));
    },
    'Group Chat plus button must create a backend transcript channel receipt for real backend projects.',
  );
  const channelProject = channelSnapshot.projects.find((item) => item.id === 'p_manager_demo_001');
  const createdChannelReceipt = channelProject.transcriptChannelReceipts.find((receipt) => receipt.channelId?.startsWith('room_'));
  const channelTranscript = await fetch(`${backendRuntime.url}/projects/p_manager_demo_001/transcripts/${encodeURIComponent(createdChannelReceipt.channelId)}`).then((response) => response.json());
  assert(channelTranscript.messages?.some((message) => message.transcriptChannelReceiptChecksum === createdChannelReceipt.checksum), 'Backend-created channel transcript must expose the channel receipt proof message.');
  const channelProofMap = await fetch(`${backendRuntime.url}/projects/p_manager_demo_001/readiness-proof-map`).then((response) => response.json());
  assert(channelProofMap.transcriptChannelRoutes?.some((route) => (
    route.channelId === createdChannelReceipt.channelId
    && route.apiPath?.endsWith(`/transcripts/${encodeURIComponent(createdChannelReceipt.channelId)}`)
    && route.readyForBackendTranscriptChannel === true
    && route.proofIds?.includes(createdChannelReceipt.checksum)
    && route.timelineLogIds?.includes(createdChannelReceipt.timelineLogId)
    && route.eventIds?.includes(createdChannelReceipt.eventId)
  )), 'Readiness Proof Map must expose backend-created transcript channel routes with receipt, timeline, and event proof.');
  assert(backendResponses.some((entry) => entry.includes('POST') && entry.includes('/projects/p_manager_demo_001/transcripts')), 'Group Chat plus button must call the backend transcripts creation route.');
  await page.getByText(createdChannelReceipt.name || /Room/i).first().waitFor({ state: 'visible', timeout: 8000 });
  await page.getByTestId('project-scene-back').click();
  await scrollDashboardToStation(page);
  await page.getByTestId('manager-walkthrough-run-leader-group-assignment').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="manager-walkthrough-run-leader-group-assignment"]');
    return Boolean(button && !button.disabled);
  }, null, { timeout: 10000 });
  await page.getByTestId('manager-walkthrough-run-leader-group-assignment').click();
  await page.getByTestId('manager-action-run-output').waitFor({ state: 'visible', timeout: 15000 });
  const managerActionOutputText = await page.getByTestId('manager-action-run-output').innerText();
  assert(/Manager Action Output Nodes/i.test(managerActionOutputText), 'Manager walkthrough action must render backend output nodes.');
  assert(/Result Messages|Task Node|Agent Submission|Evidence Search|Scheduler Tick/i.test(managerActionOutputText), 'Manager walkthrough action output must expose delegated chat/task/scheduler/product output.');
  assert(/Output chat proof/i.test(managerActionOutputText), 'Manager walkthrough action output must expose chat proof exits.');
  await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.id === 'p_manager_demo_001');
      const run = project?.managerActionRunLedger?.find((item) => item.requirementId === 'leader-group-assignment');
      return Boolean(run?.resultMessageIds?.length && run?.timelineLogIds?.length);
    },
    'Manager walkthrough action must persist a Manager Action Queue receipt with message and timeline proof.',
  );
  await page.getByTestId('manager-scenario-trail').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('manager-scenario-trail-row-kickoff-brief').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('manager-scenario-trail-proof-kickoff-brief').click();
  await page.waitForFunction(() => document.body.innerText.includes('PROOF FOCUS:'), null, { timeout: 10000 });
  await page.getByTestId('project-scene-back').click();
  await scrollDashboardToStation(page);
  const projectPutCountAfterSeed = managerDemoProjectPutCount();
  assert(projectPutCountAfterSeed <= 1, 'Manager Demo compatibility seed may write the sample snapshot at most once.');
  await scrollDashboardToStation(page);
  const proofModelButton = await waitForButtonEnabled(page, 'backend-sync-proof-models', 'Sync Proof Models must be enabled before fetching proof and launch read models.');
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/production-infrastructure-rehearsal') && response.status() === 200, { timeout: 25000 }),
    proofModelButton.click(),
  ]);
  await page.getByTestId('backend-production-infrastructure-rehearsal-snapshot').waitFor({ state: 'visible', timeout: 25000 });
  const infrastructureRehearsalText = await page.getByTestId('backend-production-infrastructure-rehearsal-snapshot').innerText();
  assert(infrastructureRehearsalText.toLowerCase().includes('production infrastructure rehearsal'), 'Backend proof-model sync must render the production infrastructure rehearsal panel.');
  assert(infrastructureRehearsalText.toLowerCase().includes('/production-infrastructure-rehearsal'), 'Production infrastructure rehearsal panel must expose the standalone backend route.');

  await page.getByTestId('backend-sync-agent-autonomous-action-queue').click();
  await page.getByTestId('backend-autonomous-run-control-snapshot').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('button[data-testid^="backend-autonomous-run-control-action-run-"]:not([disabled])').first().waitFor({ state: 'visible', timeout: 15000 });

  const seededSnapshot = await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => snapshot.projects.some((project) => project.id === 'p_manager_demo_001'),
    'Manager Demo sample fixture must be adopted by the empty backend before control read-model sync.',
  );
  const seededProject = seededSnapshot.projects.find((project) => project.id === 'p_manager_demo_001');
  assert(seededProject?.sampleFixture?.id === 'manager-demo' || seededProject?.dataSource === 'sample-fixture', 'Backend-adopted Manager Demo must remain visibly marked as a sample fixture.');

  await page.locator('button[data-testid^="backend-autonomous-run-control-action-run-"]:not([disabled])').first().click();
  await page.getByTestId('backend-autonomous-run-control-run-receipt').waitFor({ state: 'visible', timeout: 15000 });
  await page.getByTestId('backend-autonomous-run-control-run-output').waitFor({ state: 'visible', timeout: 15000 });
  const runControlOutputText = await page.getByTestId('backend-autonomous-run-control-run-output').innerText();
  assert(/Run Control Output Nodes/i.test(runControlOutputText), 'Autonomous Run Control must render delegated output nodes in the UI.');
  assert(/Agent Submission|Evidence Search|Submission Review|Review Response|Result Messages|Artifact/i.test(runControlOutputText), 'Autonomous Run Control output must expose a delegated product or transcript node.');
  await page.getByTestId('backend-run-control-action-decision').waitFor({ state: 'visible', timeout: 10000 });
  const runControlDecisionText = await page.getByTestId('backend-run-control-action-decision').innerText();
  assert(/Action Decision/i.test(runControlDecisionText) && /Strategy/i.test(runControlDecisionText), 'Autonomous Run Control output must render the backend Agent action decision.');
  const runSnapshot = await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.id === 'p_manager_demo_001');
      return Boolean(project?.autonomousRunControlRunLedger?.some((run) => (
        run.schemaVersion === 'autonomous-run-control-action-run/v1'
        && run.runApiPath?.includes('/autonomous-run-control/')
        && run.timelineLogIds?.length
        && run.eventIds?.length
      )));
    },
    'Autonomous Run Control UI action must persist a backend run receipt with timeline/event proof.',
  );
  const projectAfterRun = runSnapshot.projects.find((item) => item.id === 'p_manager_demo_001');
  const delegatedRunReceipt = projectAfterRun.autonomousRunControlRunLedger.find((run) => (
    run.schemaVersion === 'autonomous-run-control-action-run/v1'
    && run.agentId
    && run.actionLane === 'agent-autonomy'
  ));
  assert(delegatedRunReceipt, 'Autonomous Run Control must delegate at least one runnable Agent-owned action.');

  const flowGraph = await fetch(`${backendRuntime.url}/projects/p_manager_demo_001/manager-flow-graph`).then((response) => response.json());
  assert(flowGraph.nodes?.some((node) => node.source === 'autonomousRunControlRuns' && node.id === `autonomous-run-control-run-${delegatedRunReceipt.id}`), 'Manager Flow Graph must expose the Autonomous Run Control run receipt node.');
  const proofMap = await fetch(`${backendRuntime.url}/projects/p_manager_demo_001/readiness-proof-map`).then((response) => response.json());
  assert(proofMap.autonomousRunControlRunRoutes?.some((route) => route.id === delegatedRunReceipt.id && route.timelineLogIds?.length && route.eventIds?.length), 'Readiness Proof Map must expose the Autonomous Run Control run receipt route.');
  const agentDashboard = await fetch(`${backendRuntime.url}/projects/p_manager_demo_001/agents/${encodeURIComponent(delegatedRunReceipt.agentId)}/dashboard`).then((response) => response.json());
  assert(agentDashboard.autonomousRunControlRuns?.rows?.some((row) => row.id === delegatedRunReceipt.id), 'Delegated Agent dashboard must expose its Autonomous Run Control receipt.');
  assert(managerDemoProjectPutCount() === projectPutCountAfterSeed, 'Autonomous Run Control must not reseed the browser snapshot after backend proof is written.');

  await page.getByTestId('backend-agent-autonomous-action-queue-snapshot').waitFor({ state: 'visible', timeout: 10000 });
  const agentActionButton = page.locator('button[data-testid^="backend-agent-autonomous-action-run-"]:not([disabled])').first();
  await agentActionButton.waitFor({ state: 'visible', timeout: 15000 });
  await agentActionButton.click();
  await page.waitForFunction(() => Boolean(
    document.querySelector('[data-testid="backend-agent-autonomous-action-running"]')
    || document.querySelector('[data-testid="backend-agent-autonomous-action-run-output"]')
  ), null, { timeout: 5000 });
  await page.getByTestId('backend-agent-autonomous-action-run-receipt').waitFor({ state: 'visible', timeout: 65000 });
  await page.getByTestId('backend-agent-autonomous-action-run-output').waitFor({ state: 'visible', timeout: 65000 });
  await page.getByTestId('backend-agent-autonomous-action-run-output-rows').waitFor({ state: 'visible', timeout: 65000 });
  const agentActionOutputText = await page.getByTestId('backend-agent-autonomous-action-run-output').innerText();
  assert(/Agent Action Output Nodes/i.test(agentActionOutputText), 'Agent Autonomous Queue must render delegated output nodes in the UI.');
  assert(/Agent Submission|Evidence Search|Submission Review|Review Response|Result Messages/i.test(agentActionOutputText), 'Agent Autonomous Queue output must expose a delegated product or transcript node.');
  await page.getByTestId('backend-agent-autonomous-action-decision').waitFor({ state: 'visible', timeout: 10000 });
  const agentActionDecisionText = await page.getByTestId('backend-agent-autonomous-action-decision').innerText();
  assert(/Action Decision/i.test(agentActionDecisionText) && /Strategy/i.test(agentActionDecisionText), 'Agent Autonomous Queue output must render the backend Agent action decision.');
  await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.id === 'p_manager_demo_001');
      return Boolean(project?.agentAutonomousActionRunLedger?.some((run) => (
        run.schemaVersion === 'agent-autonomous-action-run/v1'
        || run.route === 'agent-autonomous-action-queue-item-run'
        || run.delegatedRunKind === 'agent-work-cycle'
      )));
    },
    'Agent Autonomous Queue UI action must persist a backend Agent action receipt.',
  );
  assert(managerDemoProjectPutCount() === projectPutCountAfterSeed, 'Agent Autonomous Queue must not reseed the browser snapshot after backend proof is written.');

  await page.getByTestId('backend-autonomous-run-control-session-start').click();
  await page.getByTestId('backend-autonomous-run-control-session-receipt').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="backend-autonomous-run-control-session-scheduler-tick"]');
    return button && !button.disabled;
  }, null, { timeout: 15000 });
  const schedulerTickStartedAt = Date.now();
  await page.getByTestId('backend-autonomous-run-control-session-scheduler-tick').click();
  await page.getByTestId('backend-autonomous-run-control-session-worker-receipt').waitFor({ state: 'visible', timeout: 65000 });
  console.log(`Autopilot scheduler UI receipt latency: ${Date.now() - schedulerTickStartedAt}ms.`);
  await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.id === 'p_manager_demo_001');
      return Boolean(
        project?.autonomousRunControlSessionTickLedger?.some((tick) => tick.schemaVersion === 'autonomous-run-control-session-tick/v1')
        && project?.autonomousRunControlRunLedger?.some((run) => run.autopilotTargetSelection || run.autopilotTargetStageId)
      );
    },
    'Autopilot scheduler tick must persist a session tick and target-aware child run receipt.',
    { timeoutMs: 25000 },
  );

  const workerReceiptText = (await page.getByTestId('backend-autonomous-run-control-session-worker-receipt').innerText()).toLowerCase();
  assert(workerReceiptText.includes('/workers/autopilot/due'), 'Autopilot scheduler receipt must show the due-worker route.');
  assert(managerDemoProjectPutCount() === projectPutCountAfterSeed, 'Autopilot scheduler controls must not reseed the browser snapshot after backend proof is written.');

  console.log('Manager backend core UI validation passed.');
} catch (error) {
  await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
  const page = browser?.contexts?.()[0]?.pages?.()[0] || null;
  if (page) {
    await page.screenshot({
      path: fileURLToPath(new URL('../dist/manager-backend-core-ui-failure.png', import.meta.url)),
      fullPage: true,
    }).catch(() => {});
    const bodyText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
    console.error(`Visible page excerpt:\n${bodyText.slice(0, 1600)}`);
    const stationText = await page.getByTestId('backend-worker-station').innerText({ timeout: 1000 }).catch(() => '');
    if (stationText) console.error(`Backend Worker Station excerpt:\n${stationText.slice(-2400)}`);
  }
  if (consoleDiagnostics.length) console.error(`Console diagnostics:\n${consoleDiagnostics.join('\n')}`);
  if (backendResponses.length) console.error(`Backend traffic tail:\n${backendResponses.slice(-40).join('\n')}`);
  if (backendRequests.length) console.error(`Backend request tail:\n${backendRequests.slice(-40).join('\n')}`);
  throw error;
} finally {
  await browser?.close().catch(() => {});
  await backendServer.close().catch(() => {});
  if (staticRuntime.server) {
    await new Promise((resolve) => staticRuntime.server.close(resolve)).catch(() => {});
  }
}
