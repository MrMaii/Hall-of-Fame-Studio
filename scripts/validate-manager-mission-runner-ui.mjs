import { createServer } from 'node:http';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';
import { createModelProvider } from '../src/agents/modelProvider.js';
import { createSearchProvider } from '../src/agents/searchProvider.js';
import { createSecretVaultFromEnv } from '../src/agents/secretVault.js';

const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const DIST_DIR = join(ROOT_DIR, 'dist');
const BACKEND_STORE = new URL(`../.tmp/agent-manager-mission-runner-ui-store-${process.pid}.json`, import.meta.url);
const BACKEND_STORAGE_KEY = 'hall_of_fame_studio.agent_backend_url.v1';
const LANGUAGE_STORAGE_KEY = 'hall_of_fame_studio.language.v1';
const VIEWPORT = { width: 1440, height: 1100 };
const nativeFetch = globalThis.fetch.bind(globalThis);
const SECRET_VAULT_RECORDS_FILE = new URL(`../.tmp/agent-manager-mission-runner-ui-vault-records-${process.pid}.json`, import.meta.url);

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

async function scrollDashboardToTop(page) {
  await page.evaluate(() => {
    [...document.querySelectorAll('.overflow-y-auto')].forEach((element) => {
      element.scrollTop = 0;
    });
  });
  await page.waitForTimeout(250);
}

async function backToDashboard(page) {
  const backButton = page.getByTestId('project-scene-back');
  assert(await backButton.count() === 1, 'Project scene must expose one back-to-dashboard control.');
  await backButton.click();
  await page.getByTestId('project-dashboard-view').waitFor({ state: 'visible', timeout: 10000 });
  await scrollDashboardToStation(page);
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

function missionRowsFromProject(project) {
  if (Array.isArray(project?.productTeamMissionRuns)) return project.productTeamMissionRuns;
  if (Array.isArray(project?.productTeamMissionRuns?.rows)) return project.productTeamMissionRuns.rows;
  if (project?.productTeamMissionRuns?.latestRun) return [project.productTeamMissionRuns.latestRun];
  return [];
}

const secretVault = createSecretVaultFromEnv({
  SECRET_VAULT_ENABLED: 'true',
  SECRET_VAULT_KEY: 'manager-mission-runner-ui-local-vault-key',
  SECRET_VAULT_KEY_ID: 'manager-mission-runner-ui',
  SECRET_VAULT_RECORDS_FILE: fileURLToPath(SECRET_VAULT_RECORDS_FILE),
});
const secretVaultStatus = secretVault.status();
const llmProvider = createModelProvider({
  provider: 'openai-compatible',
  apiKey: 'mission-runner-ui-model-key',
  apiKeySource: 'local-secret-vault',
  secretVaultStatus,
  baseURL: 'https://model.local.test/v1',
  model: 'mission-runner-ui-model',
  enabled: true,
  fetchImpl: async () => new Response(JSON.stringify({
    id: 'mission-runner-ui-model-response',
    model: 'mission-runner-ui-model',
    choices: [{
      message: {
        role: 'assistant',
        content: JSON.stringify({
          ok: true,
          message: 'Local model fixture confirmed the Mission Runner UI backend provider path.',
          intent: 'continue generic product-team mission startup',
        }),
      },
    }],
    usage: { prompt_tokens: 12, completion_tokens: 12, total_tokens: 24 },
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }),
});
const searchProvider = createSearchProvider({
  provider: 'deterministic',
  apiKey: 'mission-runner-ui-search-key',
  apiKeySource: 'local-secret-vault',
  secretVaultStatus,
  enabled: true,
});

const backendServer = createAgentProjectHttpServer({
  filePath: BACKEND_STORE,
  replaceWithSeed: true,
  secretVault,
  llmProvider,
  searchProvider,
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
    if (/\/(projects|product-team-missions|workers|kickoff-meetings)\b/.test(response.url())) {
      backendResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  await page.goto(staticRuntime.url, { waitUntil: 'networkidle' });
  await page.getByText('Workspace Hub', { exact: false }).click();
  await assertPageContains(page, 'ACTIVE PROJECTS', 'Workspace dashboard must be reachable before starting a real initiation.');
  await page.getByTestId('start-initiation-button').click();
  await assertPageContains(page, 'Project Initiation Flow', 'Manager must be able to open the real initiation flow.');
  await page.getByTestId('initiation-next-invite').click();
  await page.getByTestId('initiation-next-lobby').click();
  await page.getByTestId('initiation-start-meeting').click();
  await assertPageContains(page, 'INITIATION ROUNDTABLE', 'Initiation flow must reach the kickoff meeting step.');
  await page.getByTestId('initiation-meeting-session-proof').waitFor({ state: 'visible', timeout: 8000 });
  await page.getByTestId('initiation-meeting-leader-candidate-claim-turing').waitFor({ state: 'visible', timeout: 8000 });
  const turingLeaderClaimText = await page.getByTestId('initiation-meeting-leader-candidate-claim-turing').innerText();
  assert(turingLeaderClaimText.trim().length >= 30, 'Kickoff meeting must show the Agent self-marketing claim before Leader confirmation.');
  await page.getByTestId('initiation-meeting-director-clarification').waitFor({ state: 'visible', timeout: 8000 });
  await page.getByTestId('initiation-meeting-clarification-input').fill('Manager clarified during kickoff: Turing owns backend mission proof and Curie reviews delivery evidence.');
  await page.getByTestId('initiation-meeting-save-clarification').click();
  await assertPageContains(page, 'ROLE QUESTIONS ANSWERED', 'Kickoff meeting must persist the Manager clarification before mission approval.');
  await page.getByTestId('initiation-meeting-leader-candidate-turing').click();
  await assertPageContains(page, 'MANAGER CONFIRMED IN MEETING', 'Kickoff meeting must persist the selected Leader before mission approval.');
  await page.getByTestId('initiation-meeting-next-action-0').fill('Manager decided product-team mission startup packet');
  await page.getByTestId('initiation-meeting-save-next-actions').click();
  await assertPageContains(page, 'NEXT ACTION RESOLUTION:', 'Kickoff meeting must persist next actions before mission approval.');
  await page.getByTestId('initiation-finish-meeting').click();
  await assertPageContains(page, 'Director Decisions', 'Initiation result must expose Director decisions before approval.');
  await page.getByTestId('initiation-approve-create').click();
  await page.waitForFunction(
    () => document.body.innerText.includes('Roundtable Initiation System') && document.body.innerText.includes('PROJECT DASHBOARD'),
    null,
    { timeout: 15000 },
  );

  const missionSnapshot = await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.id === 'p_roundtable_001');
      return missionRowsFromProject(project).some((run) => (
        run.schemaVersion === 'product-team-mission-run/v1'
        && run.reusedKickoffMeeting === true
        && run.kickoffMeetingId === 'meeting_p_roundtable_001'
        && run.autonomousSessionId
        && run.autonomousSessionTickId
      ));
    },
    'Browser approval must create a reused-kickoff Product Team Mission Runner receipt with Autopilot proof.',
  );
  const initiatedProject = missionSnapshot.projects.find((item) => item.id === 'p_roundtable_001');
  const missionRun = missionRowsFromProject(initiatedProject).find((run) => (
    run.schemaVersion === 'product-team-mission-run/v1'
    && run.kickoffMeetingId === 'meeting_p_roundtable_001'
  ));
  assert(missionRun?.researchOnly === false, 'Mission Runner receipt must be generic product-team, not research-only.');
  assert(missionRun?.customerAgentHandoff?.schemaVersion === 'product-team-customer-agent-handoff/v1', 'Mission Runner receipt must expose the C/A handoff contract.');
  assert(missionRun.customerAgentHandoff.readyForLocalAutonomy === true && missionRun.customerAgentHandoff.firstTickRecorded === true, 'Mission Runner C/A handoff must prove the A-side session and first tick.');
  assert(missionRun.customerAgentHandoff.nextRoutes?.collaborationIntentQueue?.endsWith('/collaboration-intent-queue'), 'Mission Runner C/A handoff must link the Collaboration Intent Queue route.');
  assert(missionRun?.proofIds?.some((id) => /director_brief|director_clarification|role_negotiation_|leader_bid_/i.test(id)), 'Mission Runner proof ids must include real kickoff transcript evidence.');
  assert(missionRun?.readRoutes?.productTeamOperatingLoop?.endsWith('/product-team-operating-loop'), 'Mission Runner receipt must link the product-team operating loop route.');
  assert(missionRun?.readRoutes?.runtimeAutonomyStatus?.endsWith('/runtime-autonomy-status'), 'Mission Runner receipt must link the Runtime Autonomy Status recovery route.');

  await scrollDashboardToStation(page);
  await page.getByTestId('backend-product-team-mission-runs-snapshot').waitFor({ state: 'visible', timeout: 20000 });
  const missionPanelText = await page.getByTestId('backend-product-team-mission-runs-snapshot').innerText();
  assert(/Product Team Mission Runner/i.test(missionPanelText), 'Manager Dashboard must render the Product Team Mission Runner panel.');
  assert(/Generic Product Team/i.test(missionPanelText), 'Mission Runner panel must label the run as generic product-team.');
  assert(/Reused Kickoff/i.test(missionPanelText), 'Mission Runner panel must show that the approved kickoff meeting was reused.');
  assert(/C\/A Handoff/i.test(missionPanelText) && /Handoff Tick/i.test(missionPanelText), 'Mission Runner panel must show the C/A handoff and first tick state.');
  await assertPageContains(page, 'Mission route:', 'Mission Runner panel must expose the backend mission route.');

  const runtimeStatus = await fetch(`${backendRuntime.url}/projects/p_roundtable_001/runtime-autonomy-status`).then((response) => response.json());
  assert(runtimeStatus.runtimeAutonomyStatus?.schemaVersion === 'runtime-autonomy-status/v1', 'Backend must expose Runtime Autonomy Status after Mission Runner approval.');
  assert(runtimeStatus.runtimeAutonomyStatus.readyForUnattendedProduction === false, 'Runtime Autonomy Status must keep unattended production autonomy blocked.');
  assert(runtimeStatus.runtimeAutonomyStatus.gates?.some((row) => row.id === 'mission-runner-started' && row.ready), 'Runtime Autonomy Status must prove Mission Runner started the A-side runtime.');
  assert(runtimeStatus.runtimeAutonomyStatus.backendRoutes?.autopilotDueWorker === '/workers/autopilot/due', 'Runtime Autonomy Status must expose the scheduler-owned Autopilot due-worker route.');
  assert(runtimeStatus.runtimeAutonomyStatus.gates?.some((row) => row.id === 'production-unattended-autonomy-blocked' && row.productionBlocker && row.ready === false), 'Runtime Autonomy Status must expose the production autonomy boundary.');

  const intentQueue = await fetch(`${backendRuntime.url}/projects/p_roundtable_001/collaboration-intent-queue`).then((response) => response.json());
  assert(intentQueue.collaborationIntentQueue?.rows?.some((row) => (
    row.source === 'product-team-customer-agent-handoff'
    && row.canRun
    && row.runApiPath?.endsWith('/autonomous-run-control/run-backend-scheduler-tick/run')
    && row.relatedIds?.some((id) => /autonomous_run_control_run_|agent_submission_/i.test(id))
  )), 'Collaboration Intent Queue must expose the Mission Runner C/A handoff as a runnable A-side intent.');
  assert((intentQueue.collaborationIntentQueue?.summary?.customerAgentHandoffIntentCount || 0) >= 1, 'Collaboration Intent Queue summary must count Mission Runner C/A handoff intents.');
  assert((intentQueue.collaborationIntentQueue?.summary?.customerAgentHandoffExecutionReadyCount || 0) >= 1, 'Collaboration Intent Queue summary must count C/A handoff execution proof.');

  const intentRunResponse = await fetch(`${backendRuntime.url}/projects/p_roundtable_001/collaboration-intent-queue/customer-agent-handoff-intent/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      includeReadModels: false,
      now: '2026-06-01T10:22:00.000Z',
    }),
  });
  const intentRun = await intentRunResponse.json();
  assert(intentRunResponse.status === 200 && intentRun.collaborationIntentRun?.schemaVersion === 'collaboration-intent-run/v1', 'Backend must run a Collaboration Intent Queue row and record a collaboration-intent-run receipt.');
  assert(intentRun.collaborationIntentRun.intentId === 'customer-agent-handoff-intent' && intentRun.collaborationIntentRun.delegatedRunKind === 'autonomous-run-control' && intentRun.collaborationIntentRun.delegatedReceiptId, 'Collaboration intent run must delegate Mission Runner C/A continuation to Autonomous Run Control.');
  assert((intentRun.collaborationIntentQueue?.summary?.collaborationIntentRunCount || 0) >= 1 && intentRun.collaborationIntentQueue.rows?.some((row) => row.id === 'customer-agent-handoff-intent' && row.latestRunId === intentRun.collaborationIntentRun.id), 'Collaboration Intent Queue must read back the latest run receipt on the source row.');

  await page.getByTestId('backend-collaboration-intent-queue-snapshot').waitFor({ state: 'visible', timeout: 25000 });
  const intentQueuePanelText = await page.getByTestId('backend-collaboration-intent-queue-snapshot').innerText();
  assert(/Intent Runs/i.test(intentQueuePanelText) && /Run intent/i.test(intentQueuePanelText), 'Manager Dashboard Collaboration Intent Queue panel must render the real intent run control.');
  const intentQueueRunButton = await waitForButtonEnabled(
    page,
    'collaboration-intent-run-customer-agent-handoff-intent',
    'Manager Dashboard must let the user run the Mission Handoff intent from the Collaboration Intent Queue.',
    { timeoutMs: 30000 },
  );
  await intentQueueRunButton.click();
  await page.getByTestId('backend-collaboration-intent-run-output').waitFor({ state: 'visible', timeout: 30000 });
  await page.getByTestId('backend-collaboration-intent-output-work-submission').waitFor({ state: 'visible', timeout: 30000 });
  const intentRunOutputText = await page.getByTestId('backend-collaboration-intent-run-output').innerText();
  assert(/Intent Output Nodes/i.test(intentRunOutputText), 'Collaboration Intent Queue run must render the delegated output node panel after a user click.');
  assert(/Agent Submission/i.test(intentRunOutputText), 'Collaboration Intent Queue output panel must show the Agent submission created by the delegated backend run, not only the run receipt.');
  assert(/Output chat proof/i.test(intentRunOutputText), 'Collaboration Intent Queue output panel must expose chat proof exits for returned output evidence.');

  const operatingLoop = await fetch(`${backendRuntime.url}/projects/p_roundtable_001/product-team-operating-loop`).then((response) => response.json());
  assert(operatingLoop.productTeamOperatingLoop?.customerSide?.handoffExecution?.schemaVersion === 'product-team-customer-agent-handoff-execution/v1', 'Backend must expose Mission Runner handoff execution on the Product Team Operating Loop.');
  assert(operatingLoop.productTeamOperatingLoop.customerSide.handoffExecution.ready === true && operatingLoop.productTeamOperatingLoop.customerSide.handoffExecution.runReceiptIds?.length >= 1, 'Product Team Operating Loop must prove C/A handoff A-side run receipts.');

  await page.getByTestId('backend-product-team-operating-loop-snapshot').waitFor({ state: 'visible', timeout: 25000 });
  const operatingLoopPanelText = await page.getByTestId('backend-product-team-operating-loop-snapshot').innerText();
  assert(/Handoff Exec/i.test(operatingLoopPanelText) && /Handoff Runs/i.test(operatingLoopPanelText) && /Handoff Outputs/i.test(operatingLoopPanelText), 'Manager Dashboard Product Team Operating Loop panel must render C/A handoff execution metrics.');

  await page.getByTestId('backend-runtime-autonomy-status-snapshot').waitFor({ state: 'visible', timeout: 25000 });
  const runtimePanelText = await page.getByTestId('backend-runtime-autonomy-status-snapshot').innerText();
  assert(/Runtime Autonomy Status/i.test(runtimePanelText), 'Manager Dashboard must render the Runtime Autonomy Status panel.');
  assert(/backend-backed/i.test(runtimePanelText), 'Runtime Autonomy Status panel must label the source as backend-backed.');
  assert(/Mission Runner/i.test(runtimePanelText), 'Runtime Autonomy Status panel must show the C-side Mission Runner gate.');
  assert(/production blocked/i.test(runtimePanelText), 'Runtime Autonomy Status panel must preserve the production autonomy boundary.');
  assert(/\/runtime-autonomy-status/i.test(runtimePanelText), 'Runtime Autonomy Status panel must expose the standalone route.');
  assert(/\/workers\/autopilot\/due/i.test(runtimePanelText), 'Runtime Autonomy Status panel must expose the scheduler-owned Autopilot due-worker route.');

  const chatProofButton = await waitForButtonEnabled(
    page,
    'backend-product-team-mission-chat-proof',
    'Mission Runner chat proof button must be enabled with real backend transcript ids.',
  );
  await chatProofButton.click();
  await assertPageContains(page, 'PROOF FOCUS:', 'Mission Runner chat proof must jump into backend Group Chat proof focus.');
  await assertPageContains(page, 'Turing owns backend mission proof', 'Mission Runner chat proof must include the Manager kickoff clarification.');
  await backToDashboard(page);

  const timelineProofButton = await waitForButtonEnabled(
    page,
    'backend-product-team-mission-timeline-proof',
    'Mission Runner timeline proof button must be enabled with real timeline ids.',
  );
  await timelineProofButton.click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:', 'Mission Runner timeline proof must jump into backend timeline proof focus.');
  await backToDashboard(page);

  const flowNodeId = `product-team-mission-run-${missionRun.id}`;
  const flowGraph = await fetch(`${backendRuntime.url}/projects/p_roundtable_001/manager-flow-graph`).then((response) => response.json());
  const missionFlowNode = flowGraph.nodes?.find((node) => node.id === flowNodeId);
  assert(missionFlowNode, 'Manager Flow Graph must expose the Mission Runner receipt node.');
  assert(missionFlowNode.attachments?.some((attachment) => (
    attachment.type === 'product-team-mission-run'
    && attachment.reusedKickoffMeeting === true
    && /\/product-team-missions\//.test(attachment.route || attachment.missionRoute || '')
  )), 'Mission Runner Flow Graph node must attach the reused-kickoff mission route.');
  assert(missionFlowNode.attachments?.some((attachment) => (
    attachment.type === 'product-team-customer-agent-handoff'
    && attachment.status === 'a-side-first-tick-recorded'
    && attachment.route?.endsWith('/autonomous-run-control')
  )), 'Mission Runner Flow Graph node must attach the C/A handoff route and status.');
  const operatingLoopFlowNode = flowGraph.nodes?.find((node) => node.id === 'product-team-operating-loop');
  assert(operatingLoopFlowNode?.attachments?.some((attachment) => (
    attachment.type === 'operating-loop-customer-agent-handoff'
    && attachment.executionReady === true
    && attachment.runReceiptCount >= 1
  )), 'Product Team Operating Loop Flow node must attach C/A handoff execution proof.');
  const runtimeFlowNode = flowGraph.nodes?.find((node) => node.id === 'runtime-autonomy-status');
  assert(runtimeFlowNode?.route?.endsWith('/runtime-autonomy-status'), 'Manager Flow Graph must expose the Runtime Autonomy Status route-backed node.');
  assert(runtimeFlowNode.attachments?.some((attachment) => attachment.type === 'runtime-autonomy-production-boundary' && attachment.status === 'production-blocked'), 'Runtime Autonomy Status Flow node must preserve the production autonomy boundary attachment.');

  const flowButton = await waitForButtonEnabled(
    page,
    'backend-product-team-mission-flow-node',
    'Mission Runner Flow node button must be enabled with a backend node id.',
  );
  await flowButton.click();
  await page.getByTestId('manager-flow-graph').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForFunction((nodeId) => {
    const metadata = document.querySelector('[data-testid="timeline-node-metadata-detail"]')?.textContent || '';
    return metadata.includes(nodeId);
  }, flowNodeId, { timeout: 15000 });
  await page.getByTestId('manager-flow-selected-proof-route').waitFor({ state: 'visible', timeout: 10000 });
  await assertPageContains(page, '/product-team-missions/', 'Mission Runner Flow node must point back to the backend mission route.');

  await backToDashboard(page);
  const runtimeFlowButton = await waitForButtonEnabled(
    page,
    'backend-runtime-autonomy-status-flow-node',
    'Runtime Autonomy Status Flow node button must be enabled with backend proof route evidence.',
  );
  await runtimeFlowButton.click();
  await page.getByTestId('manager-flow-graph').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => {
    const metadataBlocks = [...document.querySelectorAll('[data-testid="timeline-node-metadata-detail"]')].map((element) => (element.textContent || '').toLowerCase());
    const routeBlocks = [...document.querySelectorAll('[data-testid="manager-flow-selected-proof-route"]')].map((element) => (element.textContent || '').toLowerCase());
    return metadataBlocks.some((text) => text.includes('runtime-autonomy-status'))
      && routeBlocks.some((text) => text.includes('/runtime-autonomy-status'));
  }, null, { timeout: 15000 });
  await page.getByTestId('manager-flow-selected-proof-route').waitFor({ state: 'visible', timeout: 10000 });
  const selectedRuntimeRouteText = (await page.locator('[data-testid="manager-flow-selected-proof-route"]').last().textContent({ timeout: 5000 })).toLowerCase();
  assert(selectedRuntimeRouteText.includes('/runtime-autonomy-status'), 'Runtime Autonomy Status Flow node must point back to the backend status route.');

  console.log('Manager Mission Runner UI validation passed.');
} catch (error) {
  await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
  const page = browser?.contexts?.()[0]?.pages?.()[0] || null;
  if (page) {
    await page.screenshot({
      path: fileURLToPath(new URL('../dist/manager-mission-runner-ui-failure.png', import.meta.url)),
      fullPage: true,
    }).catch(() => {});
    const bodyText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
    console.error(`Visible page excerpt:\n${bodyText.slice(0, 1800)}`);
    const routeDiagnostics = await page.evaluate(() => ({
      metadataBlocks: [...document.querySelectorAll('[data-testid="timeline-node-metadata-detail"]')].map((element) => element.textContent || ''),
      routeBlocks: [...document.querySelectorAll('[data-testid="manager-flow-selected-proof-route"]')].map((element) => element.textContent || ''),
      evidenceRouteBlocks: [...document.querySelectorAll('[data-testid="manager-flow-selected-proof-route-evidence"]')].map((element) => element.textContent || ''),
    })).catch(() => null);
    if (routeDiagnostics) console.error(`Manager Flow route diagnostics:\n${JSON.stringify(routeDiagnostics, null, 2).slice(0, 3000)}`);
    const stationText = await page.getByTestId('backend-worker-station').innerText({ timeout: 1000 }).catch(() => '');
    if (stationText) console.error(`Backend Worker Station excerpt:\n${stationText.slice(-2400)}`);
  }
  if (backendResponses.length) console.error(`Backend traffic tail:\n${backendResponses.slice(-50).join('\n')}`);
  if (consoleDiagnostics.length) console.error(`Console diagnostics:\n${consoleDiagnostics.join('\n')}`);
  throw error;
} finally {
  await browser?.close().catch(() => {});
  await backendServer.close().catch(() => {});
  await new Promise((resolve) => staticRuntime.server.close(resolve)).catch(() => {});
}
