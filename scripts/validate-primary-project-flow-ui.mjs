import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const temp = resolve(root, '.tmp', `primary-project-flow-${process.pid}`);
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function listen(server) {
  await new Promise((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise);
    server.listen(0, '127.0.0.1', resolvePromise);
  });
  const address = server.address();
  return { server, url: `http://127.0.0.1:${address.port}` };
}

function staticServer() {
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      const requested = decodeURIComponent(url.pathname) === '/' ? '/index.html' : decodeURIComponent(url.pathname);
      const absolute = normalize(join(dist, requested));
      if (!absolute.startsWith(dist)) return response.writeHead(403).end('Forbidden');
      const body = await readFile(absolute);
      response.writeHead(200, { 'content-type': mime[extname(absolute)] || 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(200, { 'content-type': mime['.html'] });
      response.end(await readFile(join(dist, 'index.html')));
    }
  });
}

function modelServer() {
  return createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    const prompt = JSON.stringify(body.messages || []);
    const wantsJson = body.response_format?.type === 'json_object'
      || ((/Required JSON keys|Return JSON only/i.test(prompt)) && !/No JSON/i.test(prompt));
    const isContinuation = /continue a live project kickoff meeting/i.test(prompt);
    const content = wantsJson
      ? JSON.stringify({
          roleTurns: [
            { agentId: 'turing', type: 'role-question', text: '我负责真实项目界面验证的本地交付检查。', hears: ['curie', 'musk'] },
            { agentId: 'curie', type: 'role-volunteer', text: '我负责真实项目界面验证的独立复核。', hears: ['turing', 'musk'] },
          ],
          decisionSummary: '真实项目界面验证已经进入立项讨论。',
          risks: ['需要确认第一项本地执行工作。'],
        })
      : isContinuation
        ? [
            'turing | leader-campaign | 我可以担任负责人并安排交付顺序。',
            'curie | task-decomposition | 我会在每次决定前检查证据与风险。',
            'musk | next-action | 我会立即开始第一项执行工作。',
          ].join('\n')
        : [
            'turing | role-question | 我负责真实项目界面验证的本地交付检查。',
            'curie | role-volunteer | 我负责真实项目界面验证的独立复核。',
            'musk | role-volunteer | 我负责推动真实项目界面验证的第一项工作。',
          ].join('\n');
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      id: 'local-primary-project-flow',
      object: 'chat.completion',
      model: body.model || 'local-test-model',
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 16, total_tokens: 26 },
    }));
  });
}

function searchServer() {
  return createServer(async (request, response) => {
    for await (const _chunk of request) { /* consume request */ }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ results: [
      { title: '本地验证资料一', url: 'http://127.0.0.1/source-1', snippet: '本地资料摘要。' },
      { title: '本地验证资料二', url: 'http://127.0.0.1/source-2', snippet: '本地复核资料摘要。' },
    ] }));
  });
}

async function waitForBackend(child, timeoutMs = 15000) {
  return new Promise((resolvePromise, rejectPromise) => {
    let output = '';
    const timer = setTimeout(() => rejectPromise(new Error(`Local backend startup timed out: ${output.slice(-1000)}`)), timeoutMs);
    const inspect = (chunk) => {
      output += String(chunk);
      const match = output.match(/Agent project backend listening on (http:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolvePromise(match[1]); }
    };
    child.stdout.on('data', inspect);
    child.stderr.on('data', inspect);
    child.once('exit', code => rejectPromise(new Error(`Local backend exited early with ${code}: ${output.slice(-1000)}`)));
  });
}

async function launchBrowser() {
  try { return await chromium.launch({ headless: true }); }
  catch { return chromium.launch({ channel: 'msedge', headless: true }); }
}

async function fill(page, testId, value) {
  const input = page.getByTestId(testId);
  await input.waitFor({ state: 'visible' });
  await input.fill(value);
}

async function waitEnabled(locator, timeoutMs = 15000) {
  await locator.waitFor({ state: 'visible', timeout: timeoutMs });
  await locator.evaluate((element, timeout) => new Promise((resolvePromise, rejectPromise) => {
    const deadline = Date.now() + timeout;
    const check = () => {
      if (!element.disabled) return resolvePromise();
      if (Date.now() >= deadline) return rejectPromise(new Error('Button remained disabled.'));
      setTimeout(check, 50);
    };
    check();
  }), timeoutMs);
}

await rm(temp, { recursive: true, force: true });
await mkdir(temp, { recursive: true });
const ui = await listen(staticServer());
const model = await listen(modelServer());
const search = await listen(searchServer());
const backend = spawn(process.execPath, [resolve(root, 'scripts', 'agent-project-server.mjs')], {
  cwd: root,
  env: {
    ...process.env,
    AGENT_PROJECT_HOST: '127.0.0.1',
    AGENT_PROJECT_PORT: '0',
    AGENT_PROJECT_STORE: resolve(temp, 'store.json'),
    AGENT_PROJECT_RUNTIME_ROOT: resolve(temp, 'runtime'),
    AGENT_LOCAL_AUTH_STORE: resolve(temp, 'auth.json'),
    AGENT_LOCAL_AUTH_REQUIRED: 'true',
    AGENT_SECURITY_AUDIT_LOG: resolve(temp, 'security-audit.jsonl'),
    SECRET_VAULT_ENABLED: 'true',
    SECRET_VAULT_KEY: 'primary-project-flow-local-key',
    SECRET_VAULT_KEY_ID: 'primary-project-flow-v1',
    SECRET_VAULT_RECORDS_FILE: resolve(temp, 'vault.json'),
    MODEL_PROVIDER: 'openai-compatible',
    MODEL_BASE_URL: `${model.url}/v1`,
    MODEL_NAME: 'local-test-model',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let browser;
let page;
try {
  const backendUrl = await waitForBackend(backend);
  browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript(({ backendUrl }) => {
    window.__AGENT_BACKEND_URL__ = backendUrl;
    window.localStorage.setItem('hall_of_fame_studio.agent_backend_url.v1', JSON.stringify(backendUrl));
    window.localStorage.setItem('hall_of_fame_studio.language.v1', 'zh');
  }, { backendUrl });
  const externalRequests = [];
  let delayConsoleCoreReads = false;
  await context.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url());
    const hostname = requestUrl.hostname;
    if (!['127.0.0.1', 'localhost'].includes(hostname)) {
      externalRequests.push(route.request().url());
      await route.abort('internetdisconnected');
      return;
    }
    if (delayConsoleCoreReads && /\/projects\/[^/]+\/(?:manager-dashboard|transcripts|timeline|events)$/.test(requestUrl.pathname)) {
      await new Promise(resolvePromise => setTimeout(resolvePromise, 5000));
    }
    await route.continue();
  });
  page = await context.newPage();
  await page.goto(ui.url, { waitUntil: 'networkidle' });

  await page.getByTestId('first-run-local-auth').waitFor({ state: 'visible', timeout: 10_000 });
  await fill(page, 'first-run-username', 'primary-project-owner');
  const passwordRules = page.getByTestId('first-run-password-rules');
  await passwordRules.waitFor({ state: 'visible', timeout: 10_000 });
  await fill(page, 'first-run-password', 'abcd');
  assert(await page.getByTestId('first-run-password-rule-length').getAttribute('data-satisfied') === 'true', 'Four entered characters must satisfy the length rule.');
  assert(await page.getByTestId('first-run-password-rule-letter').getAttribute('data-satisfied') === 'true', 'A letter must satisfy the letter rule.');
  assert(await page.getByTestId('first-run-password-rule-number').getAttribute('data-satisfied') === 'false', 'A missing number must remain visibly incomplete.');
  await fill(page, 'first-run-password', 'ab12');
  await page.getByTestId('first-run-password-valid').waitFor({ state: 'visible', timeout: 10_000 });
  assert(await passwordRules.getAttribute('aria-hidden') === 'true', 'Password requirements must exit after every rule is satisfied.');
  await page.getByTestId('first-run-auth-submit').click();
  await page.getByRole('button', { name: '打开模型设置', exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByRole('button', { name: '打开模型设置', exact: true }).click();
  await fill(page, 'settings-provider-model-base-url-input', `${model.url}/v1`);
  await fill(page, 'settings-provider-model-name-input', 'local-test-model');
  await fill(page, 'settings-provider-model-key-input', 'LOCAL_PRIMARY_PROJECT_MODEL_KEY');
  const modelSave = page.getByTestId('settings-provider-seal-model-key');
  await waitEnabled(modelSave);
  await modelSave.click();
  await page.getByTestId('settings-provider-seal-receipt').waitFor({ state: 'visible', timeout: 20000 });
  await page.getByText('配置调查资料搜索（可选）').click();
  await fill(page, 'settings-provider-search-endpoint-input', `${search.url}/search`);
  await fill(page, 'settings-provider-search-key-input', 'LOCAL_PRIMARY_PROJECT_SEARCH_KEY');
  const searchSave = page.getByTestId('settings-provider-seal-search-key');
  await waitEnabled(searchSave);
  await searchSave.click();
  await page.waitForTimeout(500);
  await page.locator('[role="dialog"] header button').click();

  await page.getByTestId('first-run-start-project').waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByTestId('first-run-start-project').click();
  await page.getByLabel('项目名称').fill('真实项目界面验证');
  await page.getByLabel('一句话简介').fill('验证立项、会议、群聊、时间线与重启恢复。');
  await page.getByLabel('你想完成什么？').fill('创建一个完全保存在本机的技术工作项目，并确认主要操作可用。');
  await page.getByTestId('initiation-next-workspace').click();
  await fill(page, 'initiation-workspace-base-path', resolve(temp, 'workspaces'));
  await fill(page, 'initiation-workspace-folder-name', '真实 项目 工作区');
  await page.getByTestId('initiation-workspace-prepare').click();
  await page.waitForFunction(() => document.querySelector('[data-testid="initiation-workspace-status"]')?.textContent?.includes('已经准备好'), null, { timeout: 20000 });
  await page.getByTestId('initiation-workspace-next-invite').click();

  for (const agentId of ['turing', 'curie', 'musk']) {
    await page.getByTestId(`market-open-${agentId}`).click();
    await page.getByTestId(`initiation-contract-${agentId}`).click();
    await page.getByTestId('initiation-talent-market').waitFor({ state: 'visible', timeout: 10000 });
  }
  await page.getByTestId('initiation-next-lobby').click();
  await page.getByTestId('initiation-start-meeting').click();
  await page.getByTestId('project-meeting-room-stage').waitFor({ state: 'attached', timeout: 30000 });
  await page.getByRole('button', { name: '结束会议' }).click();
  await page.getByTestId('initiation-director-decisions').waitFor({ state: 'visible', timeout: 10000 });
  const leader = page.getByTestId('leader-candidate-turing');
  if (await leader.count()) await leader.click();
  await page.getByTestId('initiation-next-action-0').fill('完成本地项目的第一项技术检查并保存结果。');
  const approve = page.getByTestId('initiation-approve-create');
  await waitEnabled(approve, 20000);
  delayConsoleCoreReads = true;
  await approve.click();
  const consoleOpenedAt = Date.now();
  await page.getByTestId('project-overview').waitFor({ state: 'visible', timeout: 30000 });
  await page.getByTestId('project-dashboard-view').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('project-dashboard-core-models-preloader').waitFor({ state: 'visible', timeout: 2000 });
  const consoleShellLatencyMs = Date.now() - consoleOpenedAt;
  assert(consoleShellLatencyMs < 5000, `The project dashboard shell took ${consoleShellLatencyMs}ms while core reads were slow.`);
  delayConsoleCoreReads = false;
  await page.getByTestId('project-dashboard-briefing-header').waitFor({ state: 'visible', timeout: 20000 });
  const ordinaryProjectText = await page.getByTestId('project-overview').innerText();
  assert(!ordinaryProjectText.includes('ID:'), 'The project view must not expose the internal project id.');
  assert(!ordinaryProjectText.includes('backend-backed'), 'The project view must not expose backend source status codes.');
  console.log(`Full project console shell visible in ${consoleShellLatencyMs}ms with core reads delayed by 5000ms.`);
  await page.getByTestId('project-open-timeline').click();
  await page.getByTestId('manager-flow-legend').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByRole('button', { name: '返回项目' }).click();
  await page.getByTestId('project-dashboard-view').waitFor({ state: 'visible', timeout: 10000 });

  await page.getByRole('button', { name: '打开项目群聊' }).click();
  await page.getByTestId('project-chat-panel').waitFor({ state: 'visible' });
  const ordinaryChatText = await page.getByTestId('project-chat-panel').innerText();
  assert(!ordinaryChatText.includes('/projects/'), 'The ordinary project chat must not expose internal routes.');
  assert(!ordinaryChatText.includes('backend'), 'The ordinary project chat must not expose backend status wording.');
  const message = '请确认这条消息立即显示，并给出下一步工作。';
  await page.getByLabel('发送项目消息').fill(message);
  const sentAt = Date.now();
  await page.getByTestId('project-chat-send').click();
  await page.getByText(message, { exact: true }).waitFor({ state: 'visible', timeout: 1000 });
  assert(Date.now() - sentAt < 1000, 'The user message did not appear within one second.');
  await page.getByRole('button', { name: '返回项目' }).click();

  await page.getByTestId('project-open-meeting').click();
  await page.getByTestId('project-meeting-setup').waitFor({ state: 'visible', timeout: 10000 });
  const meetingAgenda = 'Decide whether the current build is ready and assign the next action.';
  await page.getByTestId('project-meeting-agenda').fill(meetingAgenda);
  for (const agentId of ['turing', 'curie', 'musk']) {
    await page.getByTestId(`project-meeting-participant-${agentId}`).click();
  }
  await page.getByTestId('project-meeting-recorder').selectOption('curie');
  await page.getByTestId('project-meeting-confirm-start').click();
  await page.getByTestId('project-meeting-room-stage').waitFor({ state: 'visible', timeout: 10000 });
  const meetingContext = await page.getByTestId('project-meeting-session-context').innerText();
  assert(meetingContext.includes(meetingAgenda), 'The meeting room must preserve the confirmed agenda.');
  assert(meetingContext.includes('3'), 'The meeting room must show all three confirmed attendees.');
  const meetingMessage = '请复核当前进度，并明确下一步工作。';
  await page.getByTestId('project-meeting-input').fill(meetingMessage);
  const meetingSentAt = Date.now();
  await page.getByTestId('project-meeting-send').click();
  const meetingMessageStatus = page.locator('[data-testid^="meeting-message-status-"]').last();
  await meetingMessageStatus.waitFor({ state: 'visible', timeout: 1000 });
  assert((await meetingMessageStatus.locator('..').innerText()).includes(meetingMessage), 'The latest meeting receipt must stay attached to the Director message.');
  assert(Date.now() - meetingSentAt < 1000, 'The meeting message did not appear within one second.');
  await meetingMessageStatus.getByText('已完成', { exact: true }).waitFor({ state: 'visible', timeout: 15000 });
  const completeMeeting = page.getByTestId('project-meeting-complete');
  await waitEnabled(completeMeeting, 15000);
  await completeMeeting.click();
  await page.getByTestId('project-meeting-completion').waitFor({ state: 'visible', timeout: 15000 });
  const meetingSummaryPath = await page.getByTestId('project-meeting-summary-path').innerText();
  assert(meetingSummaryPath.startsWith('meeting-notes/'), 'The recorder must publish the meeting minutes into the local meeting-notes folder.');
  await page.getByTestId('project-scene-back').click();

  await page.getByTestId('project-open-timeline').click();
  await page.getByTestId('manager-flow-legend').waitFor({ state: 'visible', timeout: 10000 });

  const temporarySession = await page.evaluate(() => JSON.parse(window.sessionStorage.getItem('hall_of_fame_studio.local_auth_session.v1') || 'null'));
  const directCatalogResponse = await fetch(`${backendUrl}/projects`, {
    headers: { 'x-hofs-local-auth-token': temporarySession?.token || '' },
  });
  const directCatalog = await directCatalogResponse.json();
  assert(directCatalogResponse.status === 200, 'The local project catalog was not readable before reload.');
  assert((directCatalog.projects || []).some(project => project.name === '真实项目界面验证'), 'The created project was not present in the local catalog before reload.');
  const reloadCatalogResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.origin === backendUrl && url.pathname === '/projects' && response.request().method() === 'GET';
  }, { timeout: 15_000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const catalogAfterReload = await reloadCatalogResponse;
  const catalogAfterReloadBody = await catalogAfterReload.json();
  assert(catalogAfterReload.status() === 200, 'The local project catalog did not reload successfully.');
  assert((catalogAfterReloadBody.projects || []).some(project => project.name === '真实项目界面验证'), 'The created project was missing from the local catalog after reload.');
  await page.waitForFunction(() => (
    document.querySelector('[data-testid="manager-flow-legend"]')
    || document.querySelector('[data-testid="project-dashboard-view"]')
    || document.querySelector('[aria-label="打开项目：真实项目界面验证"]')
  ), null, { timeout: 15_000 });
  if (await page.getByRole('button', { name: '打开项目：真实项目界面验证' }).count()) {
    await page.getByRole('button', { name: '打开项目：真实项目界面验证' }).click();
  } else if (await page.getByTestId('manager-flow-legend').count()) {
    await page.getByTestId('project-scene-back').click();
  }
  await page.getByTestId('project-overview').waitFor({ state: 'visible' });
  await page.getByTestId('project-dashboard-view').waitFor({ state: 'visible' });
  assert((await page.getByText('真实项目界面验证', { exact: true }).count()) > 0, 'The created local project did not survive reload.');
  assert(externalRequests.length === 0, `The local project flow attempted external network access: ${externalRequests.join(', ')}`);
  console.log('Primary real-project UI flow passed: initiation, meeting, chat, timeline, and reload recovery.');
  await context.close();
} catch (error) {
  if (page) {
    const visible = await page.locator('body').innerText().catch(() => '');
    const details = await page.locator('details').allTextContents().catch(() => []);
    console.error(`Visible page at failure:\n${visible.slice(0, 5000)}\nError details:\n${details.join('\n').slice(0, 2000)}`);
  }
  throw error;
} finally {
  if (browser) await browser.close();
  backend.kill('SIGTERM');
  await Promise.all([ui, model, search].map(runtime => new Promise(resolvePromise => runtime.server.close(resolvePromise))));
  await rm(temp, { recursive: true, force: true });
}
