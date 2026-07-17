import { createServer } from 'node:http';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';
import { createModelProvider } from '../src/agents/modelProvider.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(repoRoot, 'dist');
const tempDir = resolve(repoRoot, '.tmp', `primary-user-ui-${process.pid}`);
const backendStorageKey = 'hall_of_fame_studio.agent_backend_url.v1';
const localAuthStorageKey = 'hall_of_fame_studio.local_auth_session.v1';
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function startStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      const requestedPath = decodeURIComponent(url.pathname) === '/' ? '/index.html' : decodeURIComponent(url.pathname);
      const absolutePath = normalize(join(distDir, requestedPath));
      if (!absolutePath.startsWith(distDir)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const body = await readFile(absolutePath);
      response.writeHead(200, { 'content-type': mimeTypes[extname(absolutePath)] || 'application/octet-stream' });
      response.end(body);
    } catch {
      const fallback = await readFile(join(distDir, 'index.html'));
      response.writeHead(200, { 'content-type': mimeTypes['.html'] });
      response.end(fallback);
    }
  });
  await new Promise((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise);
    server.listen(0, '127.0.0.1', resolvePromise);
  });
  const address = server.address();
  return { server, url: `http://127.0.0.1:${address.port}` };
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => Math.max(
    document.body.scrollWidth - document.body.clientWidth,
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  ));
  assert(overflow === 0, `${label} has ${overflow}px horizontal overflow.`);
}

await rm(tempDir, { recursive: true, force: true });
await mkdir(tempDir, { recursive: true });
const llmProvider = createModelProvider({
  provider: 'openai-compatible',
  apiKey: 'primary-user-ui-local-key',
  baseURL: 'http://127.0.0.1:11434/v1',
  model: 'primary-user-ui-local-model',
  enabled: true,
  fetchImpl: async () => new Response(JSON.stringify({
    id: 'primary-user-ui-local-response',
    model: 'primary-user-ui-local-model',
    choices: [{ message: { role: 'assistant', content: 'Local primary user UI validation response.' } }],
  }), { status: 200, headers: { 'content-type': 'application/json' } }),
});
const backendServer = createAgentProjectHttpServer({
  filePath: join(tempDir, 'projects.json'),
  localAuthFilePath: join(tempDir, 'auth.json'),
  localAuthRequired: true,
  llmProvider,
  projects: [{
    id: 'responsive_ui_project',
    name: '界面适配检查项目',
    status: 'executing',
    progress: 25,
    team: [],
    tasks: [],
    logs: [],
    createdAt: '2026-07-14T00:00:00.000Z',
  }],
});
const backendRuntime = await backendServer.listen({ port: 0, host: '127.0.0.1' });
const bootstrapResponse = await fetch(`${backendRuntime.url}/local-auth/bootstrap`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'responsive-user', password: 'test1' }),
});
const bootstrapPayload = await bootstrapResponse.json();
assert(bootstrapResponse.status === 201, `Could not create isolated local UI account: ${bootstrapPayload.error || bootstrapResponse.status}.`);
const authSession = { ...bootstrapPayload.localAuth, baseUrl: backendRuntime.url };

const runtime = await startStaticServer();
let browser;
try {
  browser = await chromium.launch({ headless: true });
} catch {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
}

try {
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1600, height: 900 },
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1280, height: 720 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(({ backendUrl, backendKey, authKey, session }) => {
      window.__AGENT_BACKEND_URL__ = backendUrl;
      window.localStorage.setItem('hall_of_fame_studio.language.v1', 'zh');
      window.localStorage.setItem(backendKey, JSON.stringify(backendUrl));
      window.sessionStorage.setItem(authKey, JSON.stringify(session));
    }, { backendUrl: backendRuntime.url, backendKey: backendStorageKey, authKey: localAuthStorageKey, session: authSession });
    const page = await context.newPage();
    await page.goto(runtime.url, { waitUntil: 'networkidle' });

    const projectHub = page.getByTestId('project-hub');
    await page.getByRole('heading', { name: '项目与工作进展' }).waitFor({ state: 'visible' });
    await projectHub.getByRole('button', { name: '创建项目' }).waitFor({ state: 'visible' });
    await page.getByTestId('open-settings-button').waitFor({ state: 'visible' });
    assert(!(await page.getByText('/local-mvp-startup-readiness', { exact: false }).isVisible().catch(() => false)), 'The ordinary workspace must not expose internal startup routes.');
    await assertNoHorizontalOverflow(page, `${viewport.width}px workspace`);

    await page.getByTestId('open-settings-button').click();
    await page.getByTestId('settings-provider-model-base-url-input').waitFor({ state: 'visible' });
    assert((await page.getByTestId('settings-tab-models').count()) === 0, 'Model technical status must not appear as a duplicate ordinary settings category.');
    for (const tab of ['account', 'deployment', 'health', 'privacy', 'workspace', 'integrations', 'keys']) {
      await page.getByTestId(`settings-tab-${tab}`).click();
      await page.locator('[role="dialog"]').waitFor({ state: 'visible' });
      assert((await page.getByRole('heading', { name: '界面没有正常加载' }).count()) === 0, `Settings tab ${tab} must not trigger UI recovery.`);
      if (tab === 'health') {
        await page.getByTestId('settings-local-health-simple').waitFor({ state: 'visible' });
        await page.getByRole('button', { name: '运行基础检查', exact: true }).waitFor({ state: 'visible' });
        await page.getByRole('button', { name: '运行完整工作检查', exact: true }).waitFor({ state: 'visible' });
      }
      if (tab === 'privacy') {
        await page.getByTestId('settings-local-privacy-simple').waitFor({ state: 'visible' });
        await page.getByLabel('数据保留方式').waitFor({ state: 'visible' });
        await page.getByLabel('模型服务日志').waitFor({ state: 'visible' });
      }
      if (tab === 'deployment') {
        await page.getByTestId('settings-local-deployment').waitFor({ state: 'visible' });
        await page.getByTestId('settings-deployment-backend-url-input').waitFor({ state: 'visible' });
        await page.getByTestId('settings-deployment-save-backend-url').waitFor({ state: 'visible' });
        await page.getByRole('button', { name: 'Sync runtime', exact: true }).waitFor({ state: 'visible' });
      }
      if (tab === 'workspace') {
        await page.getByTestId('settings-local-workspace').waitFor({ state: 'visible' });
        await page.getByTestId('settings-global-language').waitFor({ state: 'visible' });
        await page.getByTestId('settings-workspace-interface-density').waitFor({ state: 'visible' });
        await page.getByTestId('settings-workspace-default-visibility').waitFor({ state: 'visible' });
        await page.getByTestId('settings-workspace-autosave-cadence').waitFor({ state: 'visible' });
        await page.getByTestId('settings-workspace-bind-path-input').waitFor({ state: 'visible' });
        await page.getByTestId('settings-workspace-sync-memory-readiness').waitFor({ state: 'visible' });
        await page.getByTestId('settings-workspace-sync-meeting-summaries').waitFor({ state: 'visible' });
      }
      if (tab === 'integrations') {
        const toolsSettings = page.getByTestId('settings-local-tools-simple');
        await toolsSettings.waitFor({ state: 'visible' });
        await page.getByTestId('settings-tool-grant-provider-test').waitFor({ state: 'visible' });
        await page.getByTestId('settings-provider-budget-daily').waitFor({ state: 'visible' });
        await page.getByTestId('settings-provider-budget-hourly').waitFor({ state: 'visible' });
        const technicalDetails = page.getByTestId('settings-tools-technical-details');
        assert(!(await technicalDetails.getAttribute('open')), 'Integration technical diagnostics must be closed by default.');
        assert(!(await page.getByText('/secret-vault/status', { exact: true }).isVisible().catch(() => false)), 'Integration routes must stay hidden until technical diagnostics are opened.');
      }
    }
    await page.locator('[role="dialog"] header button').click();

    if (viewport.width === 1920) {
      await page.getByRole('button', { name: '人才市场', exact: true }).click();
      await page.getByRole('heading', { name: '人才市场', exact: true }).waitFor({ state: 'visible' });
      await page.getByRole('button', { name: '打开档案', exact: true }).first().click();
      await page.locator('[data-testid^="market-contract-"]').click();
      const contractDialog = page.getByRole('dialog');
      await contractDialog.getByText('选择签约项目', { exact: true }).waitFor({ state: 'visible' });
      const contractText = await contractDialog.innerText();
      assert(contractText.includes('团队成员：'), 'The ordinary contract picker must explain the existing team size.');
      assert(!contractText.includes('Backend'), 'The ordinary contract picker must not expose backend wording.');
      assert(!contractText.includes('ID:'), 'The ordinary contract picker must not expose internal project ids.');
      await contractDialog.getByRole('button', { name: '关闭项目选择', exact: true }).click();
      await page.getByRole('button', { name: '返回市场', exact: true }).click();
      await page.getByRole('button', { name: '工作区中枢', exact: true }).click();
      await page.getByTestId('project-hub').waitFor({ state: 'visible' });
    }

    await page.getByLabel('创建项目').click();
    await page.getByRole('heading', { name: '发起立项' }).waitFor({ state: 'visible' });
    for (const mode of ['学生学习', '论文内容写作', '调查', '技术工作', '创作与艺术']) {
      await page.getByRole('option', { name: mode }).waitFor({ state: 'attached' });
    }
    await page.getByTestId('initiation-next-workspace').click();
    await page.getByRole('heading', { name: '选择项目保存位置' }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: '创建项目文件夹' }).waitFor({ state: 'visible' });
    assert(!(await page.getByText('/workspace/prepare', { exact: false }).isVisible().catch(() => false)), 'Workspace route must stay hidden from the ordinary page.');
    await assertNoHorizontalOverflow(page, `${viewport.width}px project workspace`);

    await context.close();
  }

  for (const scale of [1, 1.25, 1.5, 2]) {
    const viewport = { width: Math.floor(1920 / scale), height: Math.floor(1080 / scale) };
    const context = await browser.newContext({ viewport, deviceScaleFactor: scale });
    await context.addInitScript(({ backendUrl, backendKey, authKey, session }) => {
      window.__AGENT_BACKEND_URL__ = backendUrl;
      window.localStorage.setItem('hall_of_fame_studio.language.v1', 'zh');
      window.localStorage.setItem(backendKey, JSON.stringify(backendUrl));
      window.sessionStorage.setItem(authKey, JSON.stringify(session));
    }, { backendUrl: backendRuntime.url, backendKey: backendStorageKey, authKey: localAuthStorageKey, session: authSession });
    const page = await context.newPage();
    await page.goto(runtime.url, { waitUntil: 'networkidle' });
    await page.getByTestId('project-hub').getByRole('button', { name: '创建项目' }).waitFor({ state: 'visible' });
    await page.getByTestId('open-settings-button').click();
    await page.getByTestId('settings-provider-model-base-url-input').waitFor({ state: 'visible' });
    await page.locator('[role="dialog"] header button').waitFor({ state: 'visible' });
    await assertNoHorizontalOverflow(page, `${Math.round(scale * 100)}% display scale`);
    await context.close();
  }
  console.log('Primary user UI browser validation passed at all seven required viewport sizes and four display scales.');
} finally {
  await browser.close();
  await new Promise(resolvePromise => runtime.server.close(resolvePromise));
  await backendServer.close();
  await rm(tempDir, { recursive: true, force: true });
}
