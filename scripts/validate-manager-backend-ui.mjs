import { createServer } from 'node:http';
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
const BACKEND_STORAGE_KEY = 'hall_of_fame_studio.agent_backend_url.v1';
const LANGUAGE_STORAGE_KEY = 'hall_of_fame_studio.language.v1';

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
  const bodyText = await page.locator('body').innerText({ timeout: 5000 });
  assert(bodyText.includes(text), message);
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
  await page.getByText('PROJECT DASHBOARD', { exact: false }).waitFor({ state: 'visible', timeout: 5000 });
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

async function launchBrowserWithRetry(attempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await chromium.launch({ headless: true });
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
      }
    }
  }
  throw lastError;
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
  page.on('response', (response) => {
    if (response.url().includes('manager-scenario-walkthrough')) {
      walkthroughRequests.push(`response ${response.status()} ${response.url()}`);
    }
  });

  await page.goto(staticRuntime.url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Run Manager Demo Full scenario seed' }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Manager Demo: Autonomous Agent Studio'), null, { timeout: 10000 });
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
  await assertPageContains(page, 'Next best action:', 'Manager command center must show the next best action.');
  await assertPageContains(page, 'Kickoff Decision Board', 'Manager command center must expose kickoff decision closure.');
  await assertPageContains(page, 'Leader Marker', 'Manager command center must expose Leader marker readiness.');
  await assertPageContains(page, 'Next Actions Confirmed', 'Manager command center must expose kickoff next-action confirmation.');
  await assertPageContains(page, 'Kickoff proof', 'Manager command center must expose kickoff proof exits.');
  await assertPageContains(page, 'Work Loop Board', 'Manager command center must expose 24/7 work-loop proof.');
  await assertPageContains(page, 'Loop proof', 'Manager command center must expose work-loop timeline proof exits.');
  await assertPageContains(page, 'Collaboration Board', 'Manager command center must expose live collaboration proof.');
  await assertPageContains(page, 'Leader @assignments', 'Manager command center must summarize Leader group @assignments.');
  await assertPageContains(page, 'Collaboration proof', 'Manager command center must expose collaboration timeline proof exits.');
  await assertPageContains(page, 'Change Protocol Board', 'Manager command center must expose the dual-channel change protocol.');
  await assertPageContains(page, 'Owner Plan Updated', 'Manager command center must expose owner plan update state.');
  await assertPageContains(page, 'Team Resync', 'Manager command center must expose team resync state.');
  await assertPageContains(page, 'Change protocol proof', 'Manager command center must expose change protocol proof exits.');
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
  await assertPageContains(page, 'Project Brief Heard', 'Manager scenario trail must start from the kickoff brief.');
  await assertPageContains(page, 'Leader Marker Confirmed', 'Manager scenario trail must include Leader confirmation.');
  await assertPageContains(page, 'Assigned Work Progress', 'Manager scenario trail must include assigned-work progress.');
  await assertPageContains(page, 'Meeting + Google Chat Change', 'Manager scenario trail must include dual-channel change intake.');
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
  await assertPageContains(page, 'Director opens a kickoff meeting', 'Requirement matrix must include kickoff briefing coverage.');
  await assertPageContains(page, 'Leader assigns tasks by @mentioning Agents in group chat.', 'Requirement matrix must include Leader @assignment coverage.');
  await assertPageContains(page, 'The owner adds the change to their plan and syncs it back to the team.', 'Requirement matrix must include owner plan sync coverage.');
  await page.getByTestId('manager-requirement-proof-leader-group-assignment').click();
  await assertPageContains(page, 'PROOF FOCUS:', 'Manager requirement matrix proof must jump to exact evidence.');
  await backToDashboard(page);
  await scrollDashboard(page);
  await assertPageContains(page, 'Sync Trail', 'Backend Worker Station must expose a standalone scenario trail sync action.');
  await assertPageContains(page, 'Sync Package', 'Backend Worker Station must expose a manager ready package sync action.');
  await assertPageContains(page, 'Sync Audit', 'Backend Worker Station must expose a standalone use case audit sync action.');
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
  await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.id === 'p_manager_demo_001' || item.id === 'P_MANAGER_DEMO_001');
      return project?.managerActionRunLedger?.some((run) => run.requirementId === 'leader-group-assignment');
    },
    'Manager walkthrough run must persist a delegated Action Queue run receipt.',
  );
  await page.waitForFunction(() => {
    const text = document.body.innerText.toLowerCase();
    return text.includes('walkthrough step ran:')
      || text.includes('walkthrough step failed')
      || text.includes('manager action failed');
  }, null, { timeout: 20000 });
  const walkthroughRunBody = await page.locator('body').innerText();
  assert(walkthroughRunBody.toLowerCase().includes('walkthrough step ran: group @assignment'), `Manager walkthrough run button must execute the backend walkthrough step endpoint. Current status: ${walkthroughRunBody.match(/walkthrough step [^\n]+|manager action failed[^\n]*/i)?.[0] || 'not reported'}`);
  await assertPageContains(page, 'Result inspection:', 'Manager walkthrough run receipt must summarize generated messages, timeline proof, task, and cycle ids.');
  await assertPageContains(page, 'Run result proof', 'Manager walkthrough run receipt must expose a direct proof jump.');
  await scrollDashboard(page);
  await page.getByTestId('backend-sync-ready-package').click();
  await assertPageContains(page, 'Ready package sync:', 'Manager ready package sync must expose sync status.');
  await page.getByTestId('backend-manager-ready-package-snapshot').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Manager Ready Package', 'Backend Worker Station must render the manager ready package snapshot.');
  await assertPageContains(page, 'Trail Ready', 'Manager ready package snapshot must include scenario trail summary.');
  await assertPageContains(page, 'Walkthrough', 'Manager ready package snapshot must include scenario walkthrough summary.');
  await assertPageContains(page, 'Requirements', 'Manager ready package snapshot must include requirement coverage summary.');
  await assertPageContains(page, 'Kickoff Board', 'Manager ready package snapshot must include kickoff board coverage.');
  await assertPageContains(page, 'Work Loop Board', 'Manager ready package snapshot must include 24/7 work-loop board coverage.');
  await assertPageContains(page, 'Collaboration Board', 'Manager ready package snapshot must include collaboration board coverage.');
  await assertPageContains(page, 'Change Protocol', 'Manager ready package snapshot must include change protocol coverage.');
  await assertPageContains(page, 'Change Owners', 'Manager ready package snapshot must include change owner sync coverage.');
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
  await assertPageContains(page, 'MANAGER-UI-BACKEND-PULSE', 'Backend Server Pulse must update the manager dashboard.');
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
  await page.getByTestId('agent-focus-backend-dashboard-turing').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('agent-focus-backend-cadence-turing').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Backend Agent Dashboard', 'Per-Agent workspace must sync the backend Agent dashboard read model.');
  await assertPageContains(page, '/agents/turing/dashboard', 'Per-Agent workspace must expose the backend Agent dashboard route.');
  await assertPageContains(page, 'Run Agent Pulse', 'Per-Agent workspace must expose a direct backend Agent pulse control.');
  await assertPageContains(page, 'Management Priority', 'Per-Agent workspace must expose backend management priority evidence.');
  await assertPageContains(page, 'Next Run', 'Per-Agent workspace must expose backend cadence evidence.');
  await assertPageContains(page, 'Routine', 'Per-Agent workspace must expose fixed routine evidence.');
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
  await page.getByTestId('agent-focus-backend-dashboard-turing').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId(`agent-work-cycle-${managedResponseTargetId}`).click();
  await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.name === 'Manager Demo: Autonomous Agent Studio');
      return Boolean(
        project?.agentWorkerLedger?.[0]?.agentId === managedResponseTargetId
        && project.agentWorkerLedger[0].managementResponseTargetIds?.includes('turing')
        && project.logs?.some((log) => log.eventType === 'management-response' && log.agentId === managedResponseTargetId && log.targetAgentId === 'turing')
        && snapshot.messages.some((message) => message.projectId === project.id && message.agentWorker?.agentId === managedResponseTargetId && message.agentWorker?.targetAgentId === 'turing' && /picked up your management signal/i.test(message.text || '')),
      );
    },
    'Backend-connected managed Agent Pulse must respond to the manager check-in.',
  );
  await page.getByTestId(`agent-priority-${managedResponseTargetId}`).waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'RESPONDED TO', 'Backend-connected managed Agent Pulse must expose management response targets in the Team row.');
  await page.getByTestId('agent-message-target-musk').selectOption('turing');
  await page.getByTestId('agent-message-input-musk').fill('Coordination note: manager-ui-agent-message-proof must stay visible.');
  await page.getByTestId('agent-message-send-musk').click();
  await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.name === 'Manager Demo: Autonomous Agent Studio');
      return Boolean(
        project?.agentStates?.turing?.inbox?.some((item) => item.sourceMessageId?.startsWith('manager_ui_agent_message_musk_') && /manager-ui-agent-message-proof/i.test(item.text || ''))
        && project?.agentStates?.musk?.worklog?.some((item) => item.sourceMessageId?.startsWith('manager_ui_agent_message_musk_'))
        && project?.eventLedger?.some((event) => event.source === 'agent-to-agent-message' && /manager-ui-agent-message-proof/i.test(event.summary || ''))
        && snapshot.messages.some((message) => message.projectId === project.id && message.source === 'agent-to-agent-message' && /manager-ui-agent-message-proof/i.test(message.text || '')),
      );
    },
    'Backend-connected Agent Message must persist sender worklog, target inbox, chat message, and event-ledger proof.',
  );
  await assertPageContains(page, 'MANAGER-UI-AGENT-MESSAGE-PROOF', 'Backend-connected Agent Message must update the target Agent inbox row.');
  await assertPageContains(page, 'Agent Communication Flow', 'Backend-connected Agent Message must surface in the Agent communication flow.');
  await assertPageContains(page, 'Agent Message Delivery Matrix', 'Backend-connected Agent Message must expose per-target delivery proof.');
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
  await page.getByTestId('proof-map-role-clarification').getByRole('button', { name: /Kickoff chat proof/i }).click();
  await assertPageContains(page, 'PROOF FOCUS:', 'Manager proof map kickoff route must open exact chat evidence.');
  await assertPageContains(page, 'Kickoff', 'Manager proof map kickoff route must show kickoff transcript evidence.');
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
  await assertPageContains(page, 'Confirmed. I am adding "@all add a manager meeting recap packet', 'Backend-connected War Room change must render owner confirmation.');
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

  const snapshot = await fetch(`${backendRuntime.url}/snapshot`).then((response) => response.json());
  const managerProject = snapshot.projects.find((project) => project.name === 'Manager Demo: Autonomous Agent Studio');
  assert(managerProject, 'Backend UI validation must persist the manager demo project to the backend store.');
  assert(managerProject.autonomousSchedulerLedger?.[0]?.trigger === 'manager-ui-backend-pulse', 'Server Pulse must run through the backend autonomous-cycle route.');
  assert(snapshot.messages.some((message) => message.projectId === managerProject.id && message.source === 'manager-ui-backend-station-chat'), 'Server Pulse must persist backend-published chat messages.');
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
  const managerDashboard = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/manager-dashboard`).then((response) => response.json());
  assert(managerDashboard.readiness?.status === 'manager-ready' && managerDashboard.operationsBoard?.agents?.length > 0, 'Backend manager dashboard endpoint must expose readiness plus Agent operations rows.');
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
  const managerUseCaseAudit = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/manager-use-case-audit`).then((response) => response.json());
  assert(managerUseCaseAudit.status === 'covered' && managerUseCaseAudit.rows?.some((row) => row.id === 'kickoff-meeting-understanding' && row.covered) && managerUseCaseAudit.rows?.some((row) => row.id === 'owner-plan-team-sync' && row.covered), 'Backend manager use case audit endpoint must expose standalone manager story coverage.');
  const managerActionQueue = await fetch(`${backendRuntime.url}/projects/${managerProject.id}/manager-action-queue`).then((response) => response.json());
  assert(managerActionQueue.rows?.some((row) => row.requirementId === 'midproject-dual-channel-change' && row.apiPath.endsWith('/change-request') && row.routeResolved && row.requestBodyTemplate?.channelIds?.includes('google_chat') && row.requestBodyTemplate?.sourceModes?.includes('war_room_meeting')) && typeof managerActionQueue.completedCount === 'number', 'Backend manager action queue endpoint must expose executable next-action route metadata.');
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
  assert(['manager-ui-agent-pulse', 'manager-ui-management-sync'].includes(agentDashboard.latestWorker?.trigger) && agentDashboard.proof?.timelineLogIds?.length > 0, 'Backend per-Agent dashboard endpoint must expose latest worker and timeline proof.');
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
  await assertPageContains(page, 'Kickoff Roundtable', 'Initiation flow must reach the kickoff meeting step.');
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
  await page.waitForFunction(() => document.body.innerText.includes('Roundtable Initiation System') && document.body.innerText.includes('PROJECT DASHBOARD'), null, { timeout: 10000 });
  await assertPageContains(page, 'NEXT ACTION RESOLUTION', 'Approved project dashboard must show the meeting-confirmed next-action resolution.');
  await assertPageContains(page, 'AGENT RECEIPTS:', 'Approved project dashboard must show Agent receipt coverage for the next-action decision.');

  const initiationSnapshot = await fetch(`${backendRuntime.url}/snapshot`).then((response) => response.json());
  const initiatedProject = initiationSnapshot.projects.find((project) => project.id === 'p_roundtable_001');
  const initiatedMeetingSession = initiationSnapshot.kickoffMeetings?.find((meeting) => meeting.id === 'meeting_p_roundtable_001');
  assert(initiatedProject, 'Backend-connected initiation approval must persist the new project to the backend store.');
  assert(initiatedMeetingSession?.status === 'approved' && initiatedMeetingSession.approvedProjectId === 'p_roundtable_001', 'Backend-connected initiation must persist the approved kickoff meeting session and project link.');
  assert(initiatedMeetingSession.evidence?.roleTranscriptIds?.length > 0 && initiatedMeetingSession.evidence?.leaderCampaignIds?.length > 0, 'Backend-connected kickoff meeting session must persist role and Leader campaign transcript evidence.');
  assert(initiatedMeetingSession.leaderElectionResolution?.managerConfirmed && initiatedMeetingSession.leaderElectionResolution?.selectedLeaderId === 'turing', 'Backend-connected kickoff meeting session must persist manager-confirmed Leader election resolution.');
  assert(initiatedMeetingSession.nextActionResolution?.managerConfirmed && initiatedMeetingSession.nextActionResolution?.tasks?.some((task) => /manager decided in-meeting execution packet/i.test(task.text || '')), 'Backend-connected kickoff meeting session must persist manager-confirmed next-action resolution.');
  assert(initiatedMeetingSession.managerClarifications?.some((turn) => /Turing owns backend proof/i.test(turn.text || '')), 'Backend-connected kickoff meeting session must persist manager clarification turns.');
  assert(initiatedMeetingSession.roleQuestionResolutions?.some((row) => row.answered && /Turing owns backend proof/i.test(row.answerText || '')), 'Backend-connected kickoff meeting session must persist answered role-question resolution state.');
  assert(initiatedProject.initiation?.managerClarifications?.some((turn) => /Turing owns backend proof/i.test(turn.text || '')), 'Backend-connected initiation approval must carry manager clarifications into the created project.');
  assert(initiatedProject.initiation?.roleQuestionResolutions?.some((row) => row.answered && row.answerIds?.length > 0), 'Backend-connected initiation approval must carry answered role-question resolution rows into the project.');
  assert(initiatedProject.initiation?.leaderElectionResolution?.managerConfirmed && initiatedProject.initiation?.leaderElectionResolution?.leaderMarkerPersisted, 'Backend-connected initiation approval must carry confirmed Leader election resolution into the project.');
  assert(initiatedProject.initiation?.nextActionResolution?.managerConfirmed && initiatedProject.initiation?.nextActionResolution?.tasks?.some((task) => /manager decided in-meeting execution packet/i.test(task.text || '')), 'Backend-connected initiation approval must carry confirmed next-action resolution into the project.');
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

  await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
  await page.screenshot({
    path: fileURLToPath(new URL('../dist/manager-backend-ui-validation.png', import.meta.url)),
    fullPage: true,
  });

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
}
