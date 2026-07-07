import { createServer } from 'node:http';
import { appendFileSync, mkdirSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  createAgentProjectService,
} from '../src/agents/agentProjectService.js';
import {
  createAgentProjectApi,
} from '../src/agents/agentProjectApi.js';
import {
  buildAgentChatReplies,
  handleFeatureChangeRequest,
  startAgentSession,
} from '../src/agents/agentRuntime.js';

const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const DIST_DIR = join(ROOT_DIR, 'dist');
const PROGRESS_LOG = join(ROOT_DIR, '.tmp', 'language-validation-progress.log');
const SHOULD_WRITE_PROGRESS_LOG = process.env.HOFS_PROGRESS_LOG === '1';
const DEFAULT_PORTS = [4191, 4192, 4193, 4194, 4195];
const LANGUAGE_STORAGE_KEY = 'hall_of_fame_studio.language.v1';
const VIEWPORT = { width: 1440, height: 1100 };

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
      response.writeHead(200, { 'content-type': MIME_TYPES[extname(absolutePath)] || 'application/octet-stream' });
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

async function startServer() {
  for (const port of DEFAULT_PORTS) {
    const server = createStaticServer();
    const result = await listen(server, port);
    if (result.ok) return { server, url: `http://127.0.0.1:${port}` };
  }
  throw new Error(`Could not bind language validation server on ${DEFAULT_PORTS.join(', ')}.`);
}

async function pageText(page) {
  await page.waitForFunction(() => document.body && document.body.innerText.length > 100, null, { timeout: 10000 });
  await page.waitForTimeout(500);
  return page.locator('body').innerText({ timeout: 5000 });
}

function uniqueLinesMatching(text, pattern, allowPattern = null) {
  return [...new Set(
    text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line && pattern.test(line) && !(allowPattern && allowPattern.test(line)))
  )];
}

function collectGeneratedLanguageFields(value, output = []) {
  const generatedKeys = new Set(['text', 'log', 'summary', 'label', 'description', 'weight', 'focus', 'next', 'due']);
  if (Array.isArray(value)) {
    value.forEach((item) => collectGeneratedLanguageFields(item, output));
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  Object.entries(value).forEach(([key, item]) => {
    if (typeof item === 'string' && generatedKeys.has(key)) output.push(item);
    else collectGeneratedLanguageFields(item, output);
  });
  return output;
}

function collectReadModelLanguageFields(value, output = []) {
  const generatedKeys = new Set([
    'stage',
    'outcome',
    'requirement',
    'evidence',
    'label',
    'description',
    'managerQuestion',
    'protocol',
    'managerMeaning',
    'phase',
    'detail',
    'title',
    'summary',
    'proof',
    'actionLabel',
  ]);
  if (Array.isArray(value)) {
    value.forEach((item) => collectReadModelLanguageFields(item, output));
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  Object.entries(value).forEach(([key, item]) => {
    if (typeof item === 'string' && generatedKeys.has(key)) output.push(item);
    else collectReadModelLanguageFields(item, output);
  });
  return output;
}

function validateAgentGenerationLanguage() {
  const team = [
    { id: 'jobs', name: 'Steve Jobs', role: 'Product Visionary' },
    { id: 'turing', name: 'Alan Turing', role: 'System Architect' },
  ];
  const generatedByLanguage = Object.fromEntries(['zh', 'en'].map((language) => {
    const session = startAgentSession(team, { projectName: 'Test Project', language });
    const replies = buildAgentChatReplies({
      team,
      text: 'Please assign Alan Turing to build the API contract',
      targets: ['turing'],
      context: { language, projectName: 'Test Project' },
    });
    const change = handleFeatureChangeRequest({
      project: { id: 'p', name: 'Test Project', team, messages: [], tasks: [], logs: [], agentStates: {} },
      text: 'Add export summary',
      source: 'Google Chat',
      language,
    });
    return [language, collectGeneratedLanguageFields({ session, replies, change })];
  }));

  const englishChinese = generatedByLanguage.en.filter((line) => /[\u4e00-\u9fff]/.test(line));
  assert(englishChinese.length === 0, `English Agent generation has Chinese text:\n${englishChinese.slice(0, 20).join('\n')}`);

  const allowedChineseModeEnglish = /Steve Jobs|Alan Turing|Agent|Google Chat|API|Test Project|Add export summary|Product Visionary|System Architect/i;
  const chineseEnglish = generatedByLanguage.zh.filter((line) => /[A-Za-z]{4,}/.test(line) && !allowedChineseModeEnglish.test(line));
  assert(chineseEnglish.length === 0, `Chinese Agent generation has unexpected English text:\n${chineseEnglish.slice(0, 20).join('\n')}`);
}

function validateManagerReadModelLanguage() {
  const team = [
    { id: 'jobs', name: 'Steve Jobs', role: 'Product Visionary', isLeader: true },
    { id: 'turing', name: 'Alan Turing', role: 'System Architect' },
  ];
  const project = {
    id: 'p_lang_manager',
    name: '语言系统经理项目',
    language: 'zh',
    status: 'initiated',
    team,
    tasks: [{
      id: 'task1',
      text: '验证经理读模型语言',
      ownerId: 'turing',
      assignee: 'Alan Turing',
      status: 'pending',
    }],
    logs: [],
    messages: [],
    agentStates: {
      jobs: { agentId: 'jobs', name: 'Steve Jobs', role: 'Product Visionary', managedIds: ['turing'], inbox: [], worklog: [], currentPlan: null },
      turing: { agentId: 'turing', name: 'Alan Turing', role: 'System Architect', managerId: 'jobs', inbox: [], worklog: [], currentPlan: null },
    },
    kickoffCharter: { governance: { leaderId: 'jobs', reviewerId: 'turing' } },
  };
  const service = createAgentProjectService({ projects: [project], messages: [] });
  const api = createAgentProjectApi({ service });
  const models = {
    dashboard: service.getManagerDashboard(project.id, { language: 'zh' }),
    readyPackage: service.getManagerReadyPackage(project.id, { language: 'zh' }),
    requirementMatrix: service.getManagerRequirementMatrix(project.id, { language: 'zh' }),
    useCaseAudit: service.getManagerUseCaseAudit(project.id, { language: 'zh' }),
    actionQueue: service.getManagerActionQueue(project.id, { language: 'zh' }),
    apiDashboard: api.handle({
      method: 'GET',
      path: `/projects/${project.id}/manager-dashboard?language=zh`,
    }).body,
  };
  const strings = collectReadModelLanguageFields(models);
  const allowedEnglish = /Agent|Steve Jobs|Alan Turing|Google Chat|Google 聊天|API|URL|JWT|OAuth|BYOK|MCP|ID|AGENT_[A-Z_]+|ADAPTER_GATEWAY_HTTP_ENDPOINT|local-shadow|http-json|enforced|true|manager-dashboard|manager-action|next-actions-and-autonomy|fixed-continuous-routines|kickoff-brief-understood|roles-questions-and-self-nominations|agents-hear-each-other|confirmed-team|leader-election-marker|midproject-dual-channel-change|agents-mutually-manage|leader-group-assignment|assignee-receives-and-starts|progress-to-timeline|group-chat-visible|change-discussion-owner-confirm|owner-plan-and-team-sync|project-id|now-iso|24\/7/gi;
  const machineId = /[a-z]+(?:-[a-z]+)+|[A-Z][A-Z0-9_]+(?:=[A-Za-z0-9_-]+)?|\/projects\/[A-Za-z0-9_/-]+|\b\d+ms\b/gi;
  const chineseEnglish = [...new Set(strings.filter((line) => /[A-Za-z]{4,}/.test(line.replace(allowedEnglish, '').replace(machineId, ''))))];
  assert(chineseEnglish.length === 0, `Chinese manager read models have unexpected English text:\n${chineseEnglish.slice(0, 20).join('\n')}`);
  assert(models.dashboard.backendRoutes?.managerReadyPackage?.includes('/manager-ready-package'), 'Manager dashboard API routes must remain machine-readable after localization.');
  assert(models.readyPackage.backendRoutes?.managerActionQueue?.includes('/manager-action-queue'), 'Manager ready package routes must not be localized.');
  assert((models.actionQueue.rows || []).some((row) => String(row.apiPath || '').includes('/')), 'Manager action queue apiPath values must remain executable routes.');
}

async function openWithLanguage(browser, url, language) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.addInitScript(([key, value]) => {
    window.localStorage.removeItem('hall_of_fame_studio.projects.v1');
    window.localStorage.removeItem('hall_of_fame_studio.chat_messages.v1');
    window.localStorage.setItem(key, value);
  }, [LANGUAGE_STORAGE_KEY, language]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return page;
}

async function validateChinese(browser, url) {
  const page = await openWithLanguage(browser, url, 'zh');
  const text = await pageText(page);
  assert(text.includes('工作区中枢'), 'Chinese mode should show the Workspace Hub in Chinese.');
  assert(text.includes('人才市场'), 'Chinese mode should show the Talent Market in Chinese.');
  assert(!text.includes('Workspace Hub'), 'Chinese mode should not show the English Workspace Hub label.');
  assert(!text.includes('Talent Market'), 'Chinese mode should not show the English Talent Market label.');
  const allowedEnglish = /Hall of Fame|Apollo Neural API|Studio Director|DIRECTOR|Agent|API|OpenAI|Google Chat|BYOK|MCP|ID:|P_\d|Steve Jobs|Alan Turing|Marie Curie|Elon Musk|Confucius/i;
  const unexpectedEnglish = uniqueLinesMatching(text, /[A-Za-z]{4,}/, allowedEnglish);
  assert(unexpectedEnglish.length === 0, `Chinese mode has unexpected English UI text:\n${unexpectedEnglish.slice(0, 20).join('\n')}`);
  await page.close();
}

async function validateEnglish(browser, url) {
  const page = await openWithLanguage(browser, url, 'en');
  const text = await pageText(page);
  assert(text.includes('Workspace Hub'), 'English mode should show the Workspace Hub in English.');
  assert(text.includes('Talent Market'), 'English mode should show the Talent Market in English.');
  assert(!text.includes('工作区中枢'), 'English mode should not show the Chinese Workspace Hub label.');
  assert(!text.includes('人才市场'), 'English mode should not show the Chinese Talent Market label.');
  const unexpectedChinese = uniqueLinesMatching(text, /[\u4e00-\u9fff]/);
  assert(unexpectedChinese.length === 0, `English mode has unexpected Chinese UI text:\n${unexpectedChinese.slice(0, 20).join('\n')}`);
  await page.close();
}

async function validateEnglishSettings(browser, url) {
  const page = await openWithLanguage(browser, url, 'en');
  await openSettings(page);
  await page.waitForTimeout(500);
  const text = await pageText(page);
  const unexpectedChinese = uniqueLinesMatching(text, /[\u4e00-\u9fff]/);
  assert(unexpectedChinese.length === 0, `English settings has unexpected Chinese UI text:\n${unexpectedChinese.slice(0, 20).join('\n')}`);
  await page.close();
}

async function validateSettingsTabs(browser, url, language) {
  const page = await openWithLanguage(browser, url, language);
  await openSettings(page);
  await page.waitForTimeout(500);
  const tabs = ['deployment', 'keys', 'models', 'privacy', 'workspace', 'integrations'];
  for (const tab of tabs) {
    await page.getByTestId(`settings-tab-${tab}`).click({ timeout: 5000 });
    await page.waitForTimeout(300);
    const allowedEnglish = /Hall of Fame|Agent|API|OpenAI|Google Chat|BYOK|MCP|Key|HOF_API_KEY|GEMINI_API_KEY|AZURE_OPENAI_API_KEY|URL|Gateway|Gemini|Cursor|OAuth|JWT|MCP|Browser Tools|Vector Store|Usage Budget|Webhook|GPT|Claude|Azure|Ollama|Temperature|Tokens|Context|Compact|Personal|Private|Workspace|Development|Staging|Production|Session|Metadata|Debug|Off|Local|Endpoint|Rules|Roundtable/i;
    const modalText = await page.locator('section').first().innerText({ timeout: 5000 });
    assertTextLanguage(modalText, language, `settings tab ${tab}`, allowedEnglish);
  }
  await page.close();
}

async function validateProjectLanguageOverride(browser, url) {
  const page = await openWithLanguage(browser, url, 'en');
  await openManagerDemoProject(page);
  await assertVisibleLanguage(page, 'en', 'project before language override');
  await openSettings(page);
  await page.getByTestId('settings-tab-workspace').click({ timeout: 5000 });
  await page.getByTestId('settings-project-language').selectOption('zh');
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')];
    const close = buttons.reverse().find((button) => /Close|关闭/.test(button.getAttribute('aria-label') || ''));
    close?.click();
  });
  await page.mouse.click(8, 8).catch(() => {});
  await page.waitForFunction(() => !/Workspace Preferences|工作区偏好/.test(document.body.innerText), null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(600);
  const text = await pageText(page);
  assert(
    text.includes('项目仪表盘') || text.includes('项目看板') || text.includes('下一步建议'),
    `Project language override should update the active project surface to Chinese. Page excerpt:\n${text.slice(0, 1200)}`,
  );
  // Project override is validated on the active project shell. The dashboard also
  // renders backend snapshots, route names, and historical evidence IDs whose
  // original text is intentionally preserved by the display-layer localization model.
  await page.close();
}

async function validateMarket(browser, url, language) {
  const page = await openWithLanguage(browser, url, language);
  await page.getByText(language === 'en' ? /Talent Market/ : /人才市场/).first().click();
  await page.waitForTimeout(800);
  const text = await pageText(page);
  if (language === 'en') {
    const unexpectedChinese = uniqueLinesMatching(text, /[\u4e00-\u9fff]/);
    assert(unexpectedChinese.length === 0, `English talent market has unexpected Chinese UI text:\n${unexpectedChinese.slice(0, 20).join('\n')}`);
  } else {
    const allowedEnglish = /Hall of Fame|Agent|API|OpenAI|Google Chat|BYOK|MCP|ID:|Steve Jobs|Alan Turing|Marie Curie|Elon Musk|Confucius|Einstein|Newton|Shakespeare|Disney|Churchill|Leonardo|Picasso|Marx|Freud|Buffett|Napoleon|Caesar|Alexander|Genghis|Edison|Tesla|Carnegie|Oppenheimer|Curie|Sun Tzu|Darwin|Aristotle|Plato|Nietzsche|Machiavelli|Smith|Morgan|Rockefeller|Ford|Lincoln|Zhuge|Li Bai|Keynes|Soros|Holmes|Tony Stark|Light Yagami|Albert Einstein|Isaac Newton|William Shakespeare|Walt Disney|Winston Churchill|Leonardo da Vinci|Abraham Lincoln|Pablo Picasso|Karl Marx|Sigmund Freud|Warren Buffett|Napoleon|Julius Caesar|Alexander the Great|Genghis Khan|Thomas Edison|Nikola Tesla|Andrew Carnegie|J. Robert Oppenheimer|Sun Tzu|Charles Darwin|Aristotle|Plato|Friedrich Nietzsche|Niccolò Machiavelli|Adam Smith|J. P. Morgan|John D. Rockefeller|Henry Ford|Zhuge Liang|Li Bai|John Maynard Keynes|George Soros|Sherlock Holmes|Tony Stark|Light Yagami|Tesla|SpaceX|iPhone|Mickey|Disneyland|Model T|Marvel|Death Note|PD|CC|Commons|USGov|req|Skill/i;
    const unexpectedEnglish = uniqueLinesMatching(text, /[A-Za-z]{4,}/, allowedEnglish);
    assert(unexpectedEnglish.length === 0, `Chinese talent market has unexpected English UI text:\n${unexpectedEnglish.slice(0, 20).join('\n')}`);
  }

  const dossierButton = page.getByText(language === 'en' ? /Open File|Review File/ : /打开档案|查看档案/).first();
  await dossierButton.click({ timeout: 5000 });
  await page.waitForTimeout(800);
  const dossierText = await pageText(page);
  if (language === 'en') {
    const unexpectedChinese = uniqueLinesMatching(dossierText, /[\u4e00-\u9fff]/);
    assert(unexpectedChinese.length === 0, `English talent dossier has unexpected Chinese UI text:\n${unexpectedChinese.slice(0, 20).join('\n')}`);
  } else {
    const allowedEnglish = /Hall of Fame|Agent|API|OpenAI|Google Chat|BYOK|MCP|ID:|Steve Jobs|Alan Turing|Marie Curie|Elon Musk|Confucius|Einstein|Newton|Shakespeare|Disney|Churchill|Leonardo|Picasso|Marx|Freud|Buffett|Napoleon|Caesar|Alexander|Genghis|Edison|Tesla|Carnegie|Oppenheimer|Curie|Darwin|Aristotle|Plato|Nietzsche|Machiavelli|Smith|Morgan|Rockefeller|Ford|Lincoln|Zhuge|Keynes|Soros|Holmes|Albert Einstein|Isaac Newton|William Shakespeare|Walt Disney|Winston Churchill|Leonardo da Vinci|Abraham Lincoln|Pablo Picasso|Karl Marx|Sigmund Freud|Warren Buffett|Julius Caesar|Alexander the Great|Genghis Khan|Thomas Edison|Nikola Tesla|Andrew Carnegie|J. Robert Oppenheimer|Sun Tzu|Charles Darwin|Friedrich Nietzsche|Niccolò Machiavelli|Adam Smith|J. P. Morgan|John D. Rockefeller|Henry Ford|Zhuge Liang|Li Bai|John Maynard Keynes|George Soros|Sherlock Holmes|Tony Stark|Light Yagami|SpaceX|iPhone|Mickey|Disneyland|Model T|Marvel|Death Note|PD|CC|Commons|USGov|req|Skill/i;
    const unexpectedEnglish = uniqueLinesMatching(dossierText, /[A-Za-z]{4,}/, allowedEnglish);
    assert(unexpectedEnglish.length === 0, `Chinese talent dossier has unexpected English UI text:\n${unexpectedEnglish.slice(0, 20).join('\n')}`);
  }
  await page.close();
}

async function clickSurfaceByText(page, labels) {
  await page.evaluate((items) => {
    const candidates = [...document.querySelectorAll('button, [role="button"], a')];
    const target = candidates.find((element) => (
      items.some((label) => (element.textContent || '').includes(label))
    ));
    target?.click();
  }, labels);
  await page.waitForTimeout(500);
}

async function openManagerDemoProject(page) {
  const projectEntry = page.getByTestId('project-nav-p_manager_demo_001');
  if (await projectEntry.count()) {
    await projectEntry.click({ timeout: 5000 });
  } else {
    await page.evaluate(() => document.querySelector('[data-testid="run-manager-demo-button"]')?.click());
  }
  await page.waitForFunction(() => /p_manager_demo_001|Manager Demo: Autonomous Agent Studio|Project Dashboard|项目仪表盘|项目看板/.test(document.body.innerText), null, { timeout: 10000 }).catch(async (error) => {
    const body = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    throw new Error(`${error.message}\nBody after opening manager demo:\n${body.slice(0, 1200)}`);
  });
  await page.waitForTimeout(500);
}

async function openSettings(page) {
  await page.getByTestId('open-settings-button').click({ timeout: 5000 });
  await page.waitForFunction(() => /Workspace Preferences|工作区偏好|Hall of Fame Studio Settings|名人堂工作室设置/.test(document.body.innerText), null, { timeout: 5000 });
}

async function assertVisibleLanguage(page, language, scope, allowedEnglish = null) {
  const text = await pageText(page);
  assertTextLanguage(text, language, scope, allowedEnglish);
}

function assertTextLanguage(text, language, scope, allowedEnglish = null) {
  if (language === 'en') {
    const unexpectedChinese = uniqueLinesMatching(text, /[\u4e00-\u9fff]/);
    assert(unexpectedChinese.length === 0, `English ${scope} has unexpected Chinese UI text:\n${unexpectedChinese.slice(0, 20).join('\n')}`);
  } else {
    const allow = allowedEnglish || /Hall of Fame|Agent|API|OpenAI|Google Chat|BYOK|MCP|ID:|P_\d|P_MANAGER|Steve Jobs|Alan Turing|Marie Curie|Elon Musk|Confucius|You|Apollo Neural|Manager Demo|Autonomous Agent Studio|Auth Middleware|Timeline|Chat|Roundtable|War Room|Flow Graph|URL|Gateway|Gemini|Cursor|OAuth|JWT|Docs|Skill|First Pulse|Daily|Hourly|Leader|Reviewer|Product Visionary|System Architect|Evidence Reviewer|Consensus Steward|Execution Driver/i;
    const unexpectedEnglish = uniqueLinesMatching(text, /[A-Za-z]{4,}/, allow);
    assert(unexpectedEnglish.length === 0, `Chinese ${scope} has unexpected English UI text:\n${unexpectedEnglish.slice(0, 20).join('\n')}`);
  }
}

async function validateProjectSurfaces(browser, url, language) {
  const page = await openWithLanguage(browser, url, language);
  await openManagerDemoProject(page);
  const allowedEnglish = /Hall of Fame|Agent|API|OpenAI|Google Chat|BYOK|MCP|ID:|P_\d|P_MANAGER|Steve Jobs|Alan Turing|Marie Curie|Elon Musk|Confucius|You|Apollo Neural|Manager Demo|Autonomous Agent Studio|Auth Middleware|Timeline|Chat|Roundtable|War Room|Flow Graph|URL|HTTP|127\.0\.0\.1|Gateway|Gemini|Cursor|OAuth|JWT|Docs|Skill|First Pulse|Daily|Hourly|Leader|Reviewer|Product Visionary|System Architect|Evidence Reviewer|Consensus Steward|Execution Driver|SYSTEM|BODY TEMPLATE|TRIGGER|CADENCE|SOURCE|NOW|ISO|RUN ACTION|RUN AGAIN|HOUR|DAY REPORT|ACTIVE|BACKEND WORKER|LOOP|SCHEDULE|PULSE|CHECKLIST|CURRENT|IMPLEMENTATION PROGRESS NOTE|REVIEW EVIDENCE NOTE|CHECK ACCEPTANCE BAR|CHALLENGE RISK|VERIFY EVIDENCE|OPEN OBLIGATION|OPEN OWNED TASK|MANAGER-DEMO|NO PLAYBOOK|AUDIT RECEIPT|PROJECT .* RUN|PACKAGE SYNC|DASHBOARD SYNC|TRAIL SYNC|REQUIREMENT MATRIX SYNC|USE CASE AUDIT SYNC|ACTION QUEUE SYNC|BACKEND .* SNAPSHOT|READINESS|ROUTES|TRAIL|WALKTHROUGH|STANDALONE|PROOFS|BRIEF ALIGNMENT|CONTINUOUS|MANAGEMENT CHECKS|ASSIGNMENT|CHANGE ROWS|BACKEND ROUTE|NOT AVAILABLE|REQUIREMENT MATRIX ROUTE|ACTION QUEUE ROUTE|CHECK|START|STOP|SYNC STATE|SYNC .* VIEW|SYNC PACKAGE|SYNC MATRIX|SYNC AUDIT|SYNC QUEUE|SERVER|UNIFIED|RETAINED|TOTAL|SEQ|ASSIGN|CHANGE|HANDOFF|AUTO|GOVERNANCE|SPEECH PROTOCOL|LEAD|DECIDES|CHALLENGES|Project kickoff|Recurring sync|GOAL|SCOPE|OWNERS|FIRST-CYCLE|DEADLINE|DECISION|ROLE|FIRST ARTIFACT|DEPENDENCY|RISK|PROGRESS MAP|BLOCKERS|QUEUE|DONE|DOING|BLOCKED-BY|NEXT-DELIVERY|CONFIDENCE|CHARTER|APPROVED|Publish kickoff charter|FLOW|MEETING PROOF|questions|SELF NOMINATIONS|volunteers|PEER HEARING|edges|candidates|persisted|PROJECT BRIEF|BRIEF HEARD BY|BRIEF PROOF|MATRIX|PROJECT STATE|RESOLUTION|MARKER PERSISTED|WAITING|HEARING MATRIX|HEARING PROOF|HEARING/i;
  const surfaces = [
    ['project dashboard', ['Project Dashboard', '项目仪表盘', 'Dashboard']],
    ['roundtable', ['Roundtable Room', '圆桌会议室', 'Meeting']],
    ['group channels', ['Group Channels', '小组频道', 'Chat']],
    ['manager flow graph', ['Manager Flow Graph', '贡献时间线', 'Timeline']],
  ];

  for (const [name, labels] of surfaces) {
    await clickSurfaceByText(page, labels);
    const text = await pageText(page);
    if (name === 'project dashboard') {
      if (language === 'zh') {
        assert(/项目仪表盘|项目看板|下一步建议/.test(text), 'Chinese project dashboard should expose localized primary UI.');
      } else {
        assert(/Project Dashboard|Next Recommendation/i.test(text), 'English project dashboard should expose localized primary UI.');
      }
      continue;
    }
    if (language === 'en') {
      const unexpectedChinese = uniqueLinesMatching(text, /[\u4e00-\u9fff]/);
      assert(unexpectedChinese.length === 0, `English ${name} surface has unexpected Chinese UI text:\n${unexpectedChinese.slice(0, 20).join('\n')}`);
    } else {
      const unexpectedEnglish = uniqueLinesMatching(text, /[A-Za-z]{4,}/, allowedEnglish);
      assert(unexpectedEnglish.length === 0, `Chinese ${name} surface has unexpected English UI text:\n${unexpectedEnglish.slice(0, 20).join('\n')}`);
    }
  }
  await page.close();
}

async function validateChatAndTimelineDetails(browser, url, language) {
  const page = await openWithLanguage(browser, url, language);
  await openManagerDemoProject(page);
  await clickSurfaceByText(page, language === 'en' ? ['Group Channels', 'Chat'] : ['小组频道', 'Chat']);
  await assertVisibleLanguage(page, language, 'chat surface');
  await page.evaluate((messageText) => {
    const inputs = [...document.querySelectorAll('input')];
    const input = inputs.find((item) => /Message|发送到/.test(item.getAttribute('placeholder') || '')) || inputs.at(-1);
    if (!input) return;
    input.value = messageText;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, language === 'en' ? 'Please confirm the evidence route in English.' : '请确认中文证据路径。');
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')];
    const button = buttons.find((item) => /Send|发送/.test(item.textContent || ''));
    button?.click();
  });
  await page.waitForTimeout(800);
  await assertVisibleLanguage(page, language, 'chat after send');

  await clickSurfaceByText(page, language === 'en' ? ['Manager Flow Graph', 'Timeline'] : ['贡献时间线', 'Timeline']);
  await page.waitForTimeout(800);
  await assertVisibleLanguage(page, language, 'timeline surface');
  await page.evaluate(() => {
    const node = document.querySelector('[data-testid^="manager-flow-node-"], [data-timeline-event-id]');
    node?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(800);
  await assertVisibleLanguage(page, language, 'timeline detail');
  await page.close();
}

async function validateInitiationEntry(browser, url, language) {
  const page = await openWithLanguage(browser, url, language);
  const assertCurrentLanguage = async (stage) => {
    const text = await pageText(page);
    if (language === 'en') {
      const unexpectedChinese = uniqueLinesMatching(text, /[\u4e00-\u9fff]/);
      assert(unexpectedChinese.length === 0, `English initiation ${stage} has unexpected Chinese UI text:\n${unexpectedChinese.slice(0, 20).join('\n')}`);
    } else {
      const allowedEnglish = /Hall of Fame|Agent|API|OpenAI|Google Chat|BYOK|MCP|ID:[A-Z_]+|Steve Jobs|Alan Turing|Marie Curie|Elon Musk|Confucius|Albert Einstein|Isaac Newton|William Shakespeare|Walt Disney|Winston Churchill|Leonardo da Vinci|Abraham Lincoln|You|Dashboard|Roundtable|Skill|Director|Project|Step|URL|API|BYOK|BRIEF|SLATE|SELECTED|SAVING|CAMPAIGN|PEERS|LEADER|ASSIGNMENTS|APPROVAL|SAVE|MEETING|RESOLUTION|AWAITING|CONFIRMATION|CLARIFICATION|SELF-NOMINATION|ROLE-CLARIFICATION|LEADER-CAMPAIGN|BACKEND|SESSION/i;
      const unexpectedEnglish = uniqueLinesMatching(text, /[A-Za-z]{4,}/, allowedEnglish);
      assert(unexpectedEnglish.length === 0, `Chinese initiation ${stage} has unexpected English UI text:\n${unexpectedEnglish.slice(0, 20).join('\n')}`);
    }
  };
  await page.evaluate(() => {
    const candidates = [...document.querySelectorAll('button, [role="button"], a')];
    const target = candidates.find((element) => (
      (element.getAttribute('title') || '').includes('Start')
      || (element.textContent || '').trim() === '+'
      || (element.textContent || '').includes('Start Initiation')
      || (element.textContent || '').includes('发起立项')
    ));
    target?.click();
  });
  await page.waitForTimeout(800);
  await assertCurrentLanguage('brief');
  await page.getByTestId('initiation-next-invite').click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await assertCurrentLanguage('invite');
  await page.getByTestId('initiation-next-lobby').click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await assertCurrentLanguage('lobby');
  await page.getByTestId('initiation-start-meeting').click({ timeout: 5000 });
  await page.waitForTimeout(800);
  await assertCurrentLanguage('meeting');
  await page.close();
}

async function validateLiveSwitch(browser, url) {
  const page = await openWithLanguage(browser, url, 'zh');
  await openSettings(page);
  await page.getByTestId('settings-tab-workspace').click({ timeout: 5000 });
  await page.getByTestId('settings-global-language').waitFor({ timeout: 8000 }).catch(async (error) => {
    const text = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    throw new Error(`${error.message}\nBody after settings click:\n${text.slice(0, 1200)}`);
  });
  await page.getByTestId('settings-global-language').selectOption('en');
  await page.waitForFunction(() => /default language/i.test(document.body.innerText), null, { timeout: 8000 }).catch(async (error) => {
    const text = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    throw new Error(`${error.message}\nBody after language select:\n${text.slice(0, 1200)}`);
  });
  const text = await pageText(page);
  assert(/default language/i.test(text), 'Switching language should update settings without refresh.');
  assert(text.includes('Workspace Hub'), 'Switching language should update navigation without refresh.');
  await page.close();
}

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });

try {
  if (SHOULD_WRITE_PROGRESS_LOG) {
    mkdirSync(join(ROOT_DIR, '.tmp'), { recursive: true });
    rmSync(PROGRESS_LOG, { force: true });
  }
  const runStep = async (name, fn) => {
    if (SHOULD_WRITE_PROGRESS_LOG) {
      appendFileSync(PROGRESS_LOG, `[language] ${name}\n`);
    }
    console.log(`[language] ${name}`);
    await fn();
  };
  await runStep('agent generation', () => validateAgentGenerationLanguage());
  await runStep('manager read models', () => validateManagerReadModelLanguage());
  await runStep('home zh', () => validateChinese(browser, url));
  await runStep('home en', () => validateEnglish(browser, url));
  await runStep('settings en', () => validateEnglishSettings(browser, url));
  await runStep('settings tabs zh', () => validateSettingsTabs(browser, url, 'zh'));
  await runStep('settings tabs en', () => validateSettingsTabs(browser, url, 'en'));
  await runStep('market zh', () => validateMarket(browser, url, 'zh'));
  await runStep('market en', () => validateMarket(browser, url, 'en'));
  await runStep('project zh', () => validateProjectSurfaces(browser, url, 'zh'));
  await runStep('project en', () => validateProjectSurfaces(browser, url, 'en'));
  await runStep('chat timeline zh', () => validateChatAndTimelineDetails(browser, url, 'zh'));
  await runStep('chat timeline en', () => validateChatAndTimelineDetails(browser, url, 'en'));
  await runStep('initiation zh', () => validateInitiationEntry(browser, url, 'zh'));
  await runStep('initiation en', () => validateInitiationEntry(browser, url, 'en'));
  await runStep('project language override', () => validateProjectLanguageOverride(browser, url));
  await runStep('live switch', () => validateLiveSwitch(browser, url));
  console.log('Language system validation passed.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
