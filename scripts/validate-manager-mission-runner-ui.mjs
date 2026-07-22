import { createServer } from 'node:http';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';
import { createModelProvider } from '../src/agents/modelProvider.js';
import { createSearchProvider } from '../src/agents/searchProvider.js';
import { createSecretVaultFromEnv } from '../src/agents/secretVault.js';

const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const DIST_DIR = join(ROOT_DIR, 'dist');
const RUN_ID = `${process.pid}-${Date.now()}`;
const BACKEND_STORE = new URL(`../.tmp/agent-manager-mission-runner-ui-store-${RUN_ID}.json`, import.meta.url);
const PROJECT_RUNTIME_ROOT = fileURLToPath(new URL(`../.tmp/agent-manager-mission-runner-ui-workspace-${RUN_ID}`, import.meta.url));
const BACKEND_STORAGE_KEY = 'hall_of_fame_studio.agent_backend_url.v1';
const LOCAL_AUTH_STORE = new URL(`../.tmp/agent-manager-mission-runner-ui-auth-${RUN_ID}.json`, import.meta.url);
const LOCAL_AUTH_STORAGE_KEY = 'hall_of_fame_studio.local_auth_session.v1';
const LANGUAGE_STORAGE_KEY = 'hall_of_fame_studio.language.v1';
const VIEWPORT = { width: 1440, height: 1100 };
const nativeFetch = globalThis.fetch.bind(globalThis);
let backendAuthContext = null;
const SECRET_VAULT_RECORDS_FILE = new URL(`../.tmp/agent-manager-mission-runner-ui-vault-records-${RUN_ID}.json`, import.meta.url);

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
          roleTurns: [
            {
              agentId: 'turing',
              type: 'role-question',
              text: 'For Roundtable Initiation System, may I own backend proof and the local runtime gate?',
              hears: ['curie', 'confucius', 'musk'],
            },
            {
              agentId: 'curie',
              type: 'role-volunteer',
              text: 'For Roundtable Initiation System, I will review evidence before approval.',
              hears: ['turing', 'confucius', 'musk'],
            },
          ],
          agentTurns: [
            {
              agentId: 'turing',
              type: 'next-action',
              text: 'For Roundtable Initiation System, I will turn the Director clarification into backend proof work.',
              score: 9,
            },
            {
              agentId: 'curie',
              type: 'role-volunteer',
              text: 'For Roundtable Initiation System, I will review the clarified evidence before approval.',
              score: 8,
            },
          ],
          leaderCampaigns: [
            {
              agentId: 'turing',
              claim: 'For Roundtable Initiation System, I will lead the backend proof plan and report its local evidence.',
              hears: ['curie', 'confucius', 'musk'],
              score: 9,
            },
            {
              agentId: 'curie',
              claim: 'For Roundtable Initiation System, I will lead the evidence review and escalation plan.',
              hears: ['turing', 'confucius', 'musk'],
              score: 8,
            },
          ],
          recommendedLeaderId: 'turing',
          reviewerId: 'curie',
          nextActions: [
            { ownerId: 'turing', text: 'Create the Roundtable Initiation System backend proof plan.' },
            { ownerId: 'curie', text: 'Review Roundtable Initiation System evidence before approval.' },
          ],
          decisionSummary: 'Roundtable Initiation System can proceed after local backend proof and evidence review.',
          risks: ['Roundtable Initiation System must keep every proof local and durable.'],
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
const projectRuntime = createLocalProjectRuntime({ rootPath: PROJECT_RUNTIME_ROOT });

const backendServer = createAgentProjectHttpServer({
  filePath: BACKEND_STORE,
  localAuthFilePath: LOCAL_AUTH_STORE,
  localAuthRequired: true,
  replaceWithSeed: true,
  secretVault,
  llmProvider,
  searchProvider,
  projectRuntime,
});
const backendRuntime = await backendServer.listen();
const bootstrapResponse = await fetch(`${backendRuntime.url}/local-auth/bootstrap`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'mission-runner-validator', password: 'demo1' }),
});
const bootstrapPayload = await bootstrapResponse.json();
assert(bootstrapResponse.status === 201, `Could not create isolated local validation account: ${bootstrapPayload.error || bootstrapResponse.status}.`);
const localAuthSession = {
  ...bootstrapPayload.localAuth,
  baseUrl: backendRuntime.url,
};
backendAuthContext = { baseUrl: backendRuntime.url, token: localAuthSession.token };
const startupReadinessResponse = await fetch(`${backendRuntime.url}/local-mvp-startup-readiness`);
const startupReadinessPayload = await startupReadinessResponse.json();
const startupReadiness = startupReadinessPayload.localMvpStartupReadiness || {};
assert(
  startupReadinessResponse.status === 200
    && startupReadiness.schemaVersion === 'local-mvp-startup-readiness/v1'
    && startupReadiness.readyForFirstProjectRun === true,
  'Vault/provider-ready Mission Runner backend must pass local MVP startup readiness before the browser starts.',
);
assert(
  startupReadiness.summary?.modelRuntimeReady === true
    && startupReadiness.summary?.searchRuntimeReady === true,
  'Local model fixture confirmed the Mission Runner UI backend provider path.',
);
const staticServer = createStaticServer();
const staticRuntime = await listen(staticServer);
let browser = null;
const backendResponses = [];
const consoleDiagnostics = [];
const failedResponses = [];

try {
  browser = await launchBrowserWithRetry();
  const context = await browser.newContext({ viewport: VIEWPORT });
  await context.addInitScript(({ backendUrl, storageKey, localAuthStorageKey, localAuthSessionValue, languageStorageKey }) => {
    window.__AGENT_BACKEND_URL__ = backendUrl;
    window.localStorage.setItem(storageKey, JSON.stringify(backendUrl));
    window.sessionStorage.setItem(localAuthStorageKey, JSON.stringify(localAuthSessionValue));
    window.localStorage.setItem(languageStorageKey, 'en');
  }, {
    backendUrl: backendRuntime.url,
    storageKey: BACKEND_STORAGE_KEY,
    localAuthStorageKey: LOCAL_AUTH_STORAGE_KEY,
    localAuthSessionValue: localAuthSession,
    languageStorageKey: LANGUAGE_STORAGE_KEY,
  });

  const page = await context.newPage();
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleDiagnostics.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    if (/\/(projects|product-team-missions|workers|kickoff-meetings)\b/.test(response.url())) {
      backendResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  await page.goto(staticRuntime.url, { waitUntil: 'networkidle' });
  await page.getByText('Workspace Hub', { exact: false }).click();
  await assertPageContains(page, 'ACTIVE PROJECTS', 'Workspace dashboard must be reachable before starting a real initiation.');
  await page.getByTestId('workspace-open-advanced').click();
  await page.getByTestId('start-initiation-button').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('start-initiation-button').click();
  await assertPageContains(page, 'Project Initiation Flow', 'Manager must be able to open the real initiation flow.');
  await page.getByTestId('initiation-next-workspace').click();
  await page.getByTestId('initiation-workspace-base-path').fill(PROJECT_RUNTIME_ROOT);
  await page.getByTestId('initiation-workspace-prepare').click();
  await page.waitForFunction(() => !document.querySelector('[data-testid="initiation-workspace-next-invite"]')?.disabled, null, { timeout: 15000 });
  await page.getByTestId('initiation-workspace-next-invite').click();
  await page.getByTestId('initiation-talent-market').waitFor({ state: 'visible', timeout: 5000 });
  for (const agentId of ['musk', 'turing', 'curie', 'confucius']) {
    await page.getByTestId(`market-open-${agentId}`).click();
    await page.getByTestId(`initiation-contract-${agentId}`).click();
    await page.getByTestId('initiation-talent-market').waitFor({ state: 'visible', timeout: 5000 });
  }
  await page.getByTestId('initiation-next-lobby').click();
  await page.getByTestId('initiation-start-meeting').click();
  await assertPageContains(page, 'INITIATION ROUNDTABLE', 'Initiation flow must reach the kickoff meeting step.');
  await page.getByTestId('initiation-meeting-session-proof').waitFor({ state: 'visible', timeout: 8000 });
  await assertPageContains(page, 'may I own backend proof and the local runtime gate', 'Kickoff meeting must show the Agent role claim before Leader confirmation.');
  await page.getByTestId('project-meeting-input').fill('Manager clarified during kickoff: Turing owns backend mission proof and Curie reviews delivery evidence.');
  await page.getByTestId('project-meeting-send').click();
  await assertPageContains(page, 'Turing owns backend mission proof', 'Kickoff meeting must persist the Manager clarification before mission approval.');
  await page.getByRole('button', { name: 'End Meeting', exact: true }).click();
  await assertPageContains(page, 'FIVE KICKOFF CONFIRMATIONS', 'Initiation result must expose the five kickoff decisions before approval.');
  await assertPageContains(page, 'FINAL DELIVERABLES', 'Initiation result must expose final deliverables before approval.');
  const deliverableTitle = await page.getByTestId('initiation-deliverable-title-0').inputValue();
  const deliverableFile = await page.getByTestId('initiation-deliverable-file-0').inputValue();
  const deliverableOwner = await page.getByTestId('initiation-deliverable-owner-0').inputValue();
  const deliverableAcceptance = await page.getByTestId('initiation-deliverable-acceptance-0').inputValue();
  assert(deliverableTitle.trim(), 'Kickoff approval must name the final deliverable.');
  assert(/\.[a-z0-9]+$/i.test(deliverableFile.trim()), 'Kickoff approval must confirm an exact filename with an extension.');
  assert(deliverableOwner.trim(), 'Kickoff approval must confirm a deliverable owner.');
  assert(deliverableAcceptance.trim(), 'Kickoff approval must confirm a deliverable acceptance condition.');
  await page.getByTestId('initiation-next-action-0').fill('Manager decided product-team mission startup packet');
  await page.getByTestId('leader-candidate-turing').click();
  await assertPageContains(page, 'Director selected', 'Initiation result must persist the selected Leader before mission approval.');
  await page.getByTestId('initiation-approve-create').click();
  await page.getByTestId('initiation-approval-progress').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('project-dashboard-view').waitFor({ state: 'visible', timeout: 90000 });
  await page.waitForFunction(
    () => document.body.innerText.includes('Roundtable Initiation System') && document.body.innerText.includes('PROJECT DASHBOARD'),
    null,
    { timeout: 15000 },
  );

  const missionSnapshot = await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.name === 'Roundtable Initiation System');
      return missionRowsFromProject(project).some((run) => (
        run.schemaVersion === 'product-team-mission-run/v1'
        && run.reusedKickoffMeeting === true
        && run.kickoffMeetingId
        && run.autonomousSessionId
        && run.autonomousSessionTickId
      ));
    },
    'Browser approval must create a reused-kickoff Product Team Mission Runner receipt with Autopilot proof.',
  );
  const initiatedProject = missionSnapshot.projects.find((item) => item.name === 'Roundtable Initiation System');
  const initiatedProjectId = initiatedProject?.id;
  assert(initiatedProjectId, 'Browser approval must persist the initiated project with its backend-generated id.');
  const missionRun = missionRowsFromProject(initiatedProject).find((run) => (
    run.schemaVersion === 'product-team-mission-run/v1'
    && run.reusedKickoffMeeting === true
    && run.kickoffMeetingId
  ));
  assert(missionRun?.researchOnly === false, 'Mission Runner receipt must be generic product-team, not research-only.');
  assert(missionRun?.customerAgentHandoff?.schemaVersion === 'product-team-customer-agent-handoff/v1', 'Mission Runner receipt must expose the C/A handoff contract.');
  assert(missionRun.customerAgentHandoff.readyForLocalAutonomy === true && missionRun.customerAgentHandoff.firstTickRecorded === true, 'Mission Runner C/A handoff must prove the A-side session and first tick.');
  assert(missionRun.customerAgentHandoff.nextRoutes?.collaborationIntentQueue?.endsWith('/collaboration-intent-queue'), 'Mission Runner C/A handoff must link the Collaboration Intent Queue route.');
  assert(missionRun?.proofIds?.some((id) => /director_brief|director_clarification|role_negotiation_|leader_bid_/i.test(id)), 'Mission Runner proof ids must include real kickoff transcript evidence.');
  assert(missionRun?.readRoutes?.productTeamOperatingLoop?.endsWith('/product-team-operating-loop'), 'Mission Runner receipt must link the product-team operating loop route.');
  assert(missionRun?.readRoutes?.runtimeAutonomyStatus?.endsWith('/runtime-autonomy-status'), 'Mission Runner receipt must link the Runtime Autonomy Status recovery route.');

  const confirmedDeliverables = initiatedProject?.initiation?.deliverableResolution?.deliverables || [];
  assert(initiatedProject?.initiation?.deliverableResolution?.managerConfirmed === true, 'Browser approval must persist the Director-confirmed deliverable resolution.');
  assert(confirmedDeliverables.length >= 1, 'Browser approval must persist at least one confirmed deliverable.');
  assert(initiatedProject.tasks?.length === confirmedDeliverables.length, 'Leader planning must not invent file deliverables beyond the confirmed kickoff list.');
  assert(initiatedProject.tasks.every((task) => confirmedDeliverables.some((deliverable) => (
    deliverable.fileName === task.workDefinition?.artifactFileName
  ))), 'Every project file task must point to a filename confirmed in the kickoff meeting.');

  if (process.env.HOF_KICKOFF_DELIVERABLES_ONLY !== '1') {

  await scrollDashboardToStation(page);
  await page.getByTestId('backend-product-team-mission-runs-snapshot').waitFor({ state: 'visible', timeout: 20000 });
  const missionPanelText = await page.getByTestId('backend-product-team-mission-runs-snapshot').innerText();
  assert(/Product Team Mission Runner/i.test(missionPanelText), 'Manager Dashboard must render the Product Team Mission Runner panel.');
  assert(/Generic Product Team/i.test(missionPanelText), 'Mission Runner panel must label the run as generic product-team.');
  assert(/Reused Kickoff/i.test(missionPanelText), 'Mission Runner panel must show that the approved kickoff meeting was reused.');
  assert(/C\/A Handoff/i.test(missionPanelText) && /Handoff Tick/i.test(missionPanelText), 'Mission Runner panel must show the C/A handoff and first tick state.');
  await assertPageContains(page, 'Mission route:', 'Mission Runner panel must expose the backend mission route.');

  const runtimeStatus = await fetch(`${backendRuntime.url}/projects/${encodeURIComponent(initiatedProjectId)}/runtime-autonomy-status`).then((response) => response.json());
  assert(runtimeStatus.runtimeAutonomyStatus?.schemaVersion === 'runtime-autonomy-status/v1', 'Backend must expose Runtime Autonomy Status after Mission Runner approval.');
  assert(runtimeStatus.runtimeAutonomyStatus.readyForUnattendedProduction === false, 'Runtime Autonomy Status must keep unattended production autonomy blocked.');
  assert(runtimeStatus.runtimeAutonomyStatus.gates?.some((row) => row.id === 'mission-runner-started' && row.ready), 'Runtime Autonomy Status must prove Mission Runner started the A-side runtime.');
  assert(runtimeStatus.runtimeAutonomyStatus.backendRoutes?.autopilotDueWorker === '/workers/autopilot/due', 'Runtime Autonomy Status must expose the scheduler-owned Autopilot due-worker route.');
  assert(runtimeStatus.runtimeAutonomyStatus.gates?.some((row) => row.id === 'production-unattended-autonomy-blocked' && row.productionBlocker && row.ready === false), 'Runtime Autonomy Status must expose the production autonomy boundary.');

  const intentQueue = await fetch(`${backendRuntime.url}/projects/${encodeURIComponent(initiatedProjectId)}/collaboration-intent-queue`).then((response) => response.json());
  assert(intentQueue.collaborationIntentQueue?.rows?.some((row) => (
    row.source === 'product-team-customer-agent-handoff'
    && row.canRun
    && row.runApiPath?.endsWith('/autonomous-run-control/run-backend-scheduler-tick/run')
    && row.relatedIds?.some((id) => /autonomous_run_control_run_|agent_submission_/i.test(id))
  )), 'Collaboration Intent Queue must expose the Mission Runner C/A handoff as a runnable A-side intent.');
  assert((intentQueue.collaborationIntentQueue?.summary?.customerAgentHandoffIntentCount || 0) >= 1, 'Collaboration Intent Queue summary must count Mission Runner C/A handoff intents.');
  assert((intentQueue.collaborationIntentQueue?.summary?.customerAgentHandoffExecutionReadyCount || 0) >= 1, 'Collaboration Intent Queue summary must count C/A handoff execution proof.');

  const intentRunResponse = await fetch(`${backendRuntime.url}/projects/${encodeURIComponent(initiatedProjectId)}/collaboration-intent-queue/customer-agent-handoff-intent/run`, {
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

  const operatingLoop = await fetch(`${backendRuntime.url}/projects/${encodeURIComponent(initiatedProjectId)}/product-team-operating-loop`).then((response) => response.json());
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
  const flowGraph = await fetch(`${backendRuntime.url}/projects/${encodeURIComponent(initiatedProjectId)}/manager-flow-graph`).then((response) => response.json());
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

  }
  console.log(process.env.HOF_KICKOFF_DELIVERABLES_ONLY === '1'
    ? 'Kickoff deliverables UI validation passed.'
    : 'Manager Mission Runner UI validation passed.');
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
  if (failedResponses.length) console.error(`Failed response tail:\n${failedResponses.slice(-50).join('\n')}`);
  if (consoleDiagnostics.length) console.error(`Console diagnostics:\n${consoleDiagnostics.join('\n')}`);
  throw error;
} finally {
  await browser?.close().catch(() => {});
  await backendServer.close().catch(() => {});
  await new Promise((resolve) => staticRuntime.server.close(resolve)).catch(() => {});
}
