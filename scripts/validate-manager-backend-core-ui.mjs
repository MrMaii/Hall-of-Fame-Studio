import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';

const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const DIST_DIR = join(ROOT_DIR, 'dist');
const BACKEND_STORE = new URL('../.tmp/agent-manager-backend-core-ui-store.json', import.meta.url);
const BACKEND_STORAGE_KEY = 'hall_of_fame_studio.agent_backend_url.v1';
const LANGUAGE_STORAGE_KEY = 'hall_of_fame_studio.language.v1';
const VIEWPORT = { width: 1440, height: 1100 };
const nativeFetch = globalThis.fetch.bind(globalThis);

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

async function launchBrowserWithRetry(attempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await chromium.launch({ headless: true });
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
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
  replaceWithSeed: true,
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
  await page.getByRole('button', { name: /Load Sample Fixture.*Manager demo data/i }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Manager Demo: Autonomous Agent Studio'), null, { timeout: 10000 });
  await page.getByTestId('project-sample-fixture-banner').waitFor({ state: 'visible', timeout: 5000 });

  await scrollDashboardToStation(page);
  const station = page.getByTestId('backend-worker-station');
  await station.getByRole('button', { name: /Check/i }).click();
  await station.getByText('Online', { exact: true }).waitFor({ state: 'visible', timeout: 8000 });
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
  await page.locator('[data-testid^="backend-autonomous-run-control-action-run-"]:not([disabled])').first().waitFor({ state: 'visible', timeout: 15000 });

  const seededSnapshot = await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => snapshot.projects.some((project) => project.id === 'p_manager_demo_001'),
    'Manager Demo sample fixture must be adopted by the empty backend before control read-model sync.',
  );
  const seededProject = seededSnapshot.projects.find((project) => project.id === 'p_manager_demo_001');
  assert(seededProject?.sampleFixture?.id === 'manager-demo' || seededProject?.dataSource === 'sample-fixture', 'Backend-adopted Manager Demo must remain visibly marked as a sample fixture.');

  await page.locator('[data-testid^="backend-autonomous-run-control-action-run-"]:not([disabled])').first().click();
  await page.getByTestId('backend-autonomous-run-control-run-receipt').waitFor({ state: 'visible', timeout: 15000 });
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

  await page.getByTestId('backend-agent-autonomous-action-queue-snapshot').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('[data-testid^="backend-agent-autonomous-action-run-"]:not([disabled])').first().waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('[data-testid^="backend-agent-autonomous-action-run-"]:not([disabled])').first().click();
  await page.getByTestId('backend-agent-autonomous-action-run-receipt').waitFor({ state: 'visible', timeout: 15000 });
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

  await page.getByTestId('backend-autonomous-run-control-session-start').click();
  await page.getByTestId('backend-autonomous-run-control-session-receipt').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="backend-autonomous-run-control-session-scheduler-tick"]');
    return button && !button.disabled;
  }, null, { timeout: 15000 });
  await page.getByTestId('backend-autonomous-run-control-session-scheduler-tick').click();
  await page.getByTestId('backend-autonomous-run-control-session-worker-receipt').waitFor({ state: 'visible', timeout: 20000 });
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
  if (backendResponses.length) console.error(`Backend traffic tail:\n${backendResponses.slice(-40).join('\n')}`);
  if (consoleDiagnostics.length) console.error(`Console diagnostics:\n${consoleDiagnostics.join('\n')}`);
  throw error;
} finally {
  await browser?.close().catch(() => {});
  await backendServer.close().catch(() => {});
  await new Promise((resolve) => staticRuntime.server.close(resolve)).catch(() => {});
}
