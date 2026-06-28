import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const REQUESTED_URL = process.env.MANAGER_DEMO_URL || null;
const DEFAULT_PORTS = [4173, 4174, 4175, 4176, 4180];
const VIEWPORT = { width: 1440, height: 1100 };
const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const DIST_DIR = join(ROOT_DIR, 'dist');
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
  if (!condition) {
    throw new Error(message);
  }
}

async function canReach(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
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

async function ensureServer() {
  if (REQUESTED_URL) {
    if (await canReach(REQUESTED_URL)) return { server: null, url: REQUESTED_URL };
    throw new Error(`Could not reach MANAGER_DEMO_URL ${REQUESTED_URL}.`);
  }

  for (const port of DEFAULT_PORTS) {
    const server = createStaticServer();
    const result = await listen(server, port);
    if (result.ok) {
      return { server, url: `http://127.0.0.1:${port}` };
    }
  }

  throw new Error(`Could not bind a local static server on ports ${DEFAULT_PORTS.join(', ')}.`);
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

async function scrollDashboardToBottom(page) {
  await page.evaluate(() => {
    const scrollers = [...document.querySelectorAll('.overflow-y-auto')];
    scrollers.forEach((element) => {
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

async function backToDashboard(page) {
  const backButton = page.getByTestId('project-scene-back');
  assert(await backButton.count() === 1, 'Project scene must expose one back-to-dashboard control.');
  await backButton.click();
  await page.getByText('PROJECT DASHBOARD', { exact: false }).waitFor({ state: 'visible', timeout: 5000 });
  await scrollDashboardToBottom(page);
}

async function assertChatPrefill(page, expectedChannel, expectedSnippet) {
  const input = page.getByPlaceholder(`Message #${expectedChannel}...`);
  await input.waitFor({ state: 'visible', timeout: 5000 });
  assert(await input.count() === 1, `Expected chat input for ${expectedChannel}.`);
  const value = await input.inputValue();
  assert(value.includes(expectedSnippet), `Expected ${expectedChannel} prefill to include "${expectedSnippet}", got "${value}".`);
  return input;
}

async function sendChatPrefill(page, expectedChannel) {
  const input = page.getByPlaceholder(`Message #${expectedChannel}...`);
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

async function assertMeetingPrefill(page, expectedSnippet) {
  const input = page.getByTestId('project-meeting-input');
  await input.waitFor({ state: 'visible', timeout: 5000 });
  assert(await input.count() === 1, 'Expected one Roundtable meeting input.');
  const value = await input.inputValue();
  assert(value.includes(expectedSnippet), `Expected meeting prefill to include "${expectedSnippet}", got "${value}".`);
  return input;
}

async function sendMeetingPrefill(page) {
  const input = page.getByTestId('project-meeting-input');
  await input.press('Enter');
  await page.waitForFunction(() => {
    const inputElement = document.querySelector('[data-testid="project-meeting-input"]');
    return inputElement && inputElement.value === '';
  }, null, { timeout: 5000 });
}

const { server, url } = await ensureServer();
const browser = await chromium.launch({ headless: true });
const consoleErrors = [];
const pageErrors = [];

try {
  const context = await browser.newContext({ viewport: VIEWPORT });
  await context.addInitScript(([key, value]) => {
    window.localStorage.setItem(key, value);
  }, [LANGUAGE_STORAGE_KEY, 'en']);
  const page = await context.newPage();
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleErrors.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.stack || error.message);
  });

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  const demoButton = page.getByRole('button', { name: 'Run Manager Demo Full scenario seed' });
  assert(await demoButton.count() === 1, 'Dashboard must expose exactly one Run Manager Demo entry point.');
  await demoButton.click();

  await page.waitForFunction(() => document.body.innerText.includes('Manager Demo: Autonomous Agent Studio'), null, { timeout: 10000 });
  const scenarioControlCenter = page.getByTestId('scenario-control-center');
  await scenarioControlCenter.scrollIntoViewIfNeeded();
  await scenarioControlCenter.waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Scenario Control Center');
  await assertPageContains(page, 'Kickoff Decisions');
  await assertPageContains(page, '24/7 Work Pulse');
  await assertPageContains(page, 'Agent Management Sync');
  await assertPageContains(page, 'Mid-project Change Intake');
  await assertPageContains(page, 'Manager Evidence Exit');
  await assertPageContains(page, '5/5 Agent receipts');
  const managerLiveCommandCenter = page.getByTestId('manager-live-command-center');
  await managerLiveCommandCenter.scrollIntoViewIfNeeded();
  await managerLiveCommandCenter.waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Manager Live Command Center');
  await assertPageContains(page, 'Next best action:');
  await assertPageContains(page, 'Kickoff Decision Board');
  await assertPageContains(page, 'Leader Marker');
  await assertPageContains(page, 'Next Actions Confirmed');
  await assertPageContains(page, 'Kickoff proof');
  await assertPageContains(page, 'Work Loop Board');
  await assertPageContains(page, 'Loop proof');
  await assertPageContains(page, 'Collaboration Board');
  await assertPageContains(page, 'Leader @assignments');
  await assertPageContains(page, 'Collaboration proof');
  await assertPageContains(page, 'Change Protocol Board');
  await assertPageContains(page, 'Owner Plan Updated');
  await assertPageContains(page, 'Team Resync');
  await assertPageContains(page, 'Change protocol proof');
  await assertPageContains(page, 'Attention Queue');
  await assertPageContains(page, 'Agent Readiness');
  await assertPageContains(page, 'Latest @Signal');
  await assertPageContains(page, 'Work Started');
  await assertPageContains(page, 'Signal proof');
  await assertPageContains(page, 'Work proof');
  await assertPageContains(page, 'Change Owner Sync');
  await assertPageContains(page, 'Owner Confirmed');
  await assertPageContains(page, 'Plan Updated');
  await assertPageContains(page, 'Team Synced');
  await assertPageContains(page, 'Owner Work');
  await page.getByTestId('manager-command-run-next').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('manager-command-lane-workers').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('manager-command-lane-google-chat').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('manager-scenario-walkthrough').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Manager Scenario Walkthrough');
  await assertPageContains(page, 'Next Gap');
  await assertPageContains(page, 'Rerunnable');
  await assertPageContains(page, 'All covered');
  await assertPageContains(page, 'Primary action:');
  await assertPageContains(page, 'Run walkthrough step');
  await assertPageContains(page, 'Walkthrough proof');
  await page.getByTestId('manager-action-playbook').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Manager Action Playbook');
  await assertPageContains(page, 'Run Action');
  await assertPageContains(page, 'Run Again');
  await assertPageContains(page, 'rerunnable');
  await assertPageContains(page, 'Open Step');
  await assertPageContains(page, 'route resolved');
  await assertPageContains(page, 'Run route:');
  await assertPageContains(page, 'Body template:');
  await assertPageContains(page, 'Manager Action Run Ledger');
  await assertPageContains(page, 'No Playbook runs yet');
  await page.getByTestId('manager-scenario-trail').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Manager Scenario Trail');
  await assertPageContains(page, 'Project Brief Heard');
  await assertPageContains(page, 'Leader Marker Confirmed');
  await assertPageContains(page, 'Assigned Work Progress');
  await assertPageContains(page, 'Meeting + Google Chat Change');
  await page.getByTestId('sync-protocol-audit').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Sync Protocol Audit');
  await assertPageContains(page, 'Backend collaboration protocol');
  await assertPageContains(page, 'Agent State');
  await assertPageContains(page, 'Ledger');
  await page.getByTestId('manager-use-case-audit').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Manager Use Case Audit');
  await assertPageContains(page, 'Group @Assignment');
  await assertPageContains(page, 'Next action:');
  await assertPageContains(page, 'Run use case action');
  await assertPageContains(page, 'Use case proof');
  await assertPageContains(page, 'Sync Audit');
  await page.getByTestId('manager-requirement-matrix').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Manager Requirement Matrix');
  await assertPageContains(page, 'Director opens a kickoff meeting');
  await assertPageContains(page, 'Leader assigns tasks by @mentioning Agents in group chat.');
  await assertPageContains(page, 'The owner adds the change to their plan and syncs it back to the team.');
  await page.getByTestId('manager-requirement-proof-leader-group-assignment').click();
  await assertPageContains(page, 'PROOF FOCUS:');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await page.getByTestId('manager-scenario-trail-proof-kickoff-brief').click();
  await assertPageContains(page, 'PROOF FOCUS:');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await page.getByTestId('manager-leader-assignment-composer').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Leader Assignment Composer');
  await assertPageContains(page, 'Submit Assignment');
  await page.getByTestId('manager-change-intake-composer').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Manager Change Intake');
  await assertPageContains(page, 'Submit Change');
  await assertPageContains(page, 'AUTONOMOUS WORK LOOP');
  await assertPageContains(page, '24/7 Operations Board');
  await assertPageContains(page, 'Project Next Run');
  await assertPageContains(page, 'Project Last Run');
  await assertPageContains(page, 'Backend Worker');
  await assertPageContains(page, 'Agent Run Queue');
  await assertPageContains(page, 'Next Agent Run');
  await assertPageContains(page, 'Latest Agent Work');
  await assertPageContains(page, 'Worker Trigger');
  await assertPageContains(page, 'Management Priority');
  await page.getByTestId('operations-agent-turing').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Continuous Work Loop');
  await assertPageContains(page, 'Scheduler State');
  await assertPageContains(page, 'Next Project Pulse');
  await assertPageContains(page, 'Agent Loops');
  await assertPageContains(page, 'Timeline Proof');
  await page.getByRole('button', { name: /Loop timeline proof/i }).first().click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Fixed Work Routines');
  await assertPageContains(page, 'Routine Checklist');
  await assertPageContains(page, 'Next Evidence');
  await page.getByTestId('routine-row-turing').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Backend Worker Station');
  await assertPageContains(page, 'Server Pulse');
  await assertPageContains(page, 'Sync State');
  await assertPageContains(page, 'Project sync');
  await assertPageContains(page, 'Unified Event Ledger');
  await assertPageContains(page, 'Retained');
  await assertPageContains(page, 'Kickoff');
  await assertPageContains(page, 'Assign');
  await assertPageContains(page, 'Change');
  await assertPageContains(page, 'Handoff');
  await assertPageContains(page, 'Auto');
  await assertPageContains(page, 'Kickoff Charter');
  await assertPageContains(page, 'Kickoff Meeting Flow');
  await assertPageContains(page, 'Kickoff Brief Alignment');
  await assertPageContains(page, 'Brief Heard By');
  await page.getByTestId('kickoff-brief-alignment').getByRole('button', { name: /Brief proof/i }).first().click();
  await assertPageContains(page, 'PROOF FOCUS:');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Confirmed Team Matrix');
  await assertPageContains(page, 'Project State');
  await assertPageContains(page, 'Charter');
  await page.getByTestId('kickoff-confirmed-team-matrix').getByRole('button', { name: /Team timeline proof/i }).first().click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Role Clarification');
  await assertPageContains(page, 'Self Nominations');
  await assertPageContains(page, 'Peer Hearing');
  await assertPageContains(page, 'Leader Campaign');
  await assertPageContains(page, 'LEADER ELECTION RESOLUTION');
  await assertPageContains(page, 'Director Confirmation');
  await assertPageContains(page, 'Leader Marker');
  await assertPageContains(page, 'Kickoff Hearing Matrix');
  await assertPageContains(page, 'Role Questions Heard');
  await assertPageContains(page, 'Self Nominations Heard');
  await assertPageContains(page, 'Leader Campaign Hearing');
  await assertPageContains(page, 'Heard By:');
  await page.getByTestId('kickoff-hearing-matrix').getByRole('button', { name: /Hearing proof/i }).first().click();
  await assertPageContains(page, 'PROOF FOCUS:');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Conversation Evidence');
  await assertPageContains(page, 'ROLE QUESTION ANSWERS');
  await page.getByTestId('kickoff-conversation-flow').getByRole('button', { name: /Conversation proof/i }).first().click();
  await assertPageContains(page, 'PROOF FOCUS:');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await page.getByRole('button', { name: /Kickoff meeting proof/i }).click();
  await assertPageContains(page, 'PROOF FOCUS:');
  await assertPageContains(page, 'Election');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Kickoff Execution Flow');
  await assertPageContains(page, 'Next Actions');
  await assertPageContains(page, 'NEXT ACTION RESOLUTION');
  await assertPageContains(page, 'AGENT RECEIPTS:');
  await assertPageContains(page, 'Leader Assignments');
  await assertPageContains(page, 'First Pulse');
  await assertPageContains(page, '24/7 Work');
  await assertPageContains(page, 'All-Agent Startup Matrix');
  await assertPageContains(page, 'Started');
  await assertPageContains(page, 'Queued');
  await assertPageContains(page, 'Routine Plan');
  await assertPageContains(page, 'Startup Proof');
  await page.getByTestId('all-agent-startup-matrix').getByRole('button', { name: /Startup timeline proof/i }).first().click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await page.getByRole('button', { name: /First pulse timeline proof/i }).click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Group Chat Transcript Index');
  await assertPageContains(page, 'Message Count');
  await assertPageContains(page, 'Archived Proofs');
  await assertPageContains(page, 'Latest Speaker');
  await assertPageContains(page, 'Receipt Coverage');
  await assertPageContains(page, 'Direct Mentions');
  await page.getByTestId('transcript-channel-main').getByRole('button', { name: /Open transcript/i }).click();
  await assertPageContains(page, 'PROOF FOCUS:');
  await assertPageContains(page, 'HEARD BY');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Change Ledger');
  await assertPageContains(page, 'Source Request');
  await assertPageContains(page, 'Team Discussion');
  await assertPageContains(page, 'Owner Confirmation');
  await assertPageContains(page, 'Owner Plan');
  await assertPageContains(page, 'Team Sync');
  await assertPageContains(page, 'Dual-channel Change Intake Matrix');
  await assertPageContains(page, 'Source Message');
  await assertPageContains(page, 'Source Receipts');
  await assertPageContains(page, 'Team Discussed');
  await page.getByTestId('dual-channel-change-intake-matrix').getByRole('button', { name: /Source channel proof/i }).first().click();
  await assertPageContains(page, 'PROOF FOCUS:');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await page.getByTestId('manager-scenario-trail-proof-dual-channel-change').click();
  await assertPageContains(page, 'PROOF FOCUS:');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Change Resolution Matrix');
  await assertPageContains(page, 'Source Intake');
  await assertPageContains(page, 'Owner First Work');
  await page.getByTestId('change-resolution-matrix').getByRole('button', { name: /Owner work timeline proof/i }).first().click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Discussion Receipts');
  await assertPageContains(page, 'Sync Targets');
  await assertPageContains(page, 'Peer Handoffs');
  await assertPageContains(page, 'Agent Management Mesh');
  await assertPageContains(page, 'Leader Chain');
  await assertPageContains(page, 'Managed Agents');
  await assertPageContains(page, 'Latest Check-in');
  await assertPageContains(page, 'Management Proof');
  await assertPageContains(page, 'RESPONSE');
  await assertPageContains(page, 'RESPONDED');
  await assertPageContains(page, 'Peer Management Matrix');
  await assertPageContains(page, 'Every independent Agent has a peer manager and a peer target');
  await page.getByTestId('peer-management-matrix-turing').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Agent Communication Flow');
  await assertPageContains(page, 'Agent Message Delivery Matrix');
  await assertPageContains(page, 'Direct Receipt');
  await assertPageContains(page, 'Target Inbox');
  await page.getByTestId('agent-message-delivery-matrix').getByRole('button', { name: /Delivery chat proof/i }).first().click();
  await assertPageContains(page, 'PROOF FOCUS:');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Sender Worklog');
  await page.getByTestId('agent-communication-flow').getByRole('button', { name: /Agent chat proof/i }).first().click();
  await assertPageContains(page, 'PROOF FOCUS:');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await page.getByTestId('management-mesh-turing').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Run Management Sync');
  await page.getByRole('button', { name: /Management timeline proof/i }).first().click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:');
  await assertPageContains(page, 'management');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Manager Scenario Readiness');
  await assertPageContains(page, '100%');
  await assertPageContains(page, 'manager-ready');
  await assertPageContains(page, 'Manager Proof Map');
  await assertPageContains(page, 'Every readiness condition has a direct evidence route');
  await page.getByTestId('proof-map-role-clarification').getByRole('button', { name: /Kickoff chat proof/i }).click();
  await assertPageContains(page, 'PROOF FOCUS:');
  await assertPageContains(page, 'Kickoff');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await page.getByTestId('proof-map-timeline-progress').getByRole('button', { name: /Timeline proof/i }).click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:');
  await page.getByTestId('timeline-evidence-detail').waitFor({ state: 'visible', timeout: 5000 });
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Leader');
  await assertPageContains(page, 'Latest Inbox');
  await assertPageContains(page, 'Open Obligation');
  await assertPageContains(page, 'Latest Worklog');
  await assertPageContains(page, 'Next Agent Run');
  await page.getByTestId('agent-focus-open-turing').click();
  await page.getByTestId('agent-focus-panel-turing').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Agent Focus Workspace');
  await assertPageContains(page, 'Run Agent Pulse');
  await assertPageContains(page, 'Owned Task Evidence');
  await assertPageContains(page, 'Independent state');
  await assertPageContains(page, 'Management Surface');
  await assertPageContains(page, 'Managed By');
  await assertPageContains(page, 'Peer Management');
  await page.getByTestId('agent-focus-management-proof-turing').click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await page.getByTestId('agent-inbox-proof-turing').click();
  await assertPageContains(page, 'PROOF FOCUS:');
  await assertPageContains(page, 'HEARD BY');
  await assertPageContains(page, 'DIRECT TARGET');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await page.getByTestId('agent-worklog-timeline-turing').click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:');
  await page.getByTestId('timeline-evidence-detail').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'SOURCE CHANNEL');
  await assertPageContains(page, 'RECEIPTS');
  await assertPageContains(page, 'DIRECT TARGETS');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Manager Demo Path');
  await assertPageContains(page, 'Simulate Google Chat change');
  await assertPageContains(page, 'Raise meeting change');
  await assertPageContains(page, 'Ask Leader to assign new work');
  await assertPageContains(page, 'Trigger Agent peer handoff');
  await assertPageContains(page, 'Leader Assignment Flow');
  await assertPageContains(page, 'Group @Assignment');
  await assertPageContains(page, 'Assignee Inbox');
  await assertPageContains(page, 'Acknowledgement');
  await assertPageContains(page, 'Work Pulse');
  await assertPageContains(page, 'Timeline Proof');
  await assertPageContains(page, 'Assignment Timeline Matrix');
  await assertPageContains(page, 'Assignee Saw It');
  await assertPageContains(page, 'Assignment Timeline Event');
  await page.getByTestId('assignment-timeline-matrix').getByRole('button', { name: /Assignment timeline event proof/i }).first().click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await assertPageContains(page, 'Assignment Work Progress Matrix');
  await assertPageContains(page, 'Progress Chat');
  await assertPageContains(page, 'Timeline Progress');
  await assertPageContains(page, 'Completion Proof');
  await page.getByTestId('assignment-work-progress-matrix').getByRole('button', { name: /Progress timeline proof/i }).first().click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await page.getByRole('button', { name: /Assignment chat proof/i }).first().click();
  await assertPageContains(page, 'PROOF FOCUS:');
  await assertPageContains(page, 'HEARD BY');
  await assertPageContains(page, 'DIRECT TARGET');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);
  await page.getByRole('button', { name: /Assignment timeline proof/i }).first().click();
  await assertPageContains(page, 'TIMELINE PROOF FOCUS:');
  await page.getByTestId('timeline-evidence-detail').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'SOURCE CHANNEL');
  await assertPageContains(page, 'DIRECT TARGETS');
  await backToDashboard(page);
  await scrollDashboardToBottom(page);

  await clickDashboardStep(page, 'google_change');
  await assertChatPrefill(page, 'Google Chat', '@all add export summary feature');
  await sendChatPrefill(page, 'Google Chat');
  await assertPageContains(page, 'Confirmed. I am adding "@all add export summary feature"');
  await assertPageContains(page, 'Plan updated: I own "@all add export summary feature"');
  await backToDashboard(page);
  await assertPageContains(page, '@all add export summary feature');
  await assertPageContains(page, 'Owner synced');

  await clickDashboardStep(page, 'meeting_change');
  await assertMeetingPrefill(page, 'manager meeting recap packet');
  await sendMeetingPrefill(page);
  await assertPageContains(page, 'Confirmed. I am adding "@all add a manager meeting recap packet');
  await assertPageContains(page, 'Plan updated: I own "@all add a manager meeting recap packet');
  await backToDashboard(page);
  await assertPageContains(page, '@all add a manager meeting recap packet from this War Room decision');
  await clickDashboardStep(page, 'dual_channel_change');
  await assertPageContains(page, 'dual-channel manager review packet');
  await assertPageContains(page, 'War Room + Google Chat');

  await clickDashboardStep(page, 'leader_assign');
  await assertChatPrefill(page, 'Main', 'prepare the next manager-review evidence packet');
  await sendChatPrefill(page, 'Main');
  await assertPageContains(page, 'prepare the next manager-review evidence packet');
  await assertPageContains(page, 'starting work now');
  await backToDashboard(page);
  await assertPageContains(page, 'prepare the next manager-review evidence packet');

  await clickDashboardStep(page, 'peer_handoff');
  await assertChatPrefill(page, 'Main', 'needs dependency help from @');
  await sendChatPrefill(page, 'Main');
  await assertPageContains(page, 'I own the dependency');
  await assertPageContains(page, 'review the next manager handoff evidence');
  await backToDashboard(page);
  await assertPageContains(page, 'review the next manager handoff evidence');

  await clickDashboardStep(page, 'timeline_evidence');
  await page.getByText('MANAGER FLOW GRAPH', { exact: false }).waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'MANAGER FLOW GRAPH');
  await assertPageContains(page, 'RESET');

  await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
  await page.screenshot({
    path: fileURLToPath(new URL('../dist/manager-demo-ui-validation.png', import.meta.url)),
    fullPage: true,
  });

  console.log('Manager demo UI validation passed.');
} catch (error) {
  const failureDir = new URL('../dist/', import.meta.url);
  await mkdir(failureDir, { recursive: true });
  const page = browser.contexts()[0]?.pages()?.[0] || null;
  if (page) {
    await page.screenshot({
      path: fileURLToPath(new URL('manager-demo-ui-failure.png', failureDir)),
      fullPage: true,
    }).catch(() => {});
    const bodyText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
    console.error(`Visible page excerpt:\n${bodyText.slice(0, 1600)}`);
  }
  if (consoleErrors.length) {
    console.error(`Console warnings/errors:\n${consoleErrors.slice(-12).join('\n')}`);
  }
  if (pageErrors.length) {
    console.error(`Page errors:\n${pageErrors.slice(-6).join('\n')}`);
  }
  throw error;
} finally {
  await browser.close();
  if (server) server.close();
}
