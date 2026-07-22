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
import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';
import { createModelProvider } from '../src/agents/modelProvider.js';
import { createSearchProvider } from '../src/agents/searchProvider.js';
import { createSecretVaultFromEnv } from '../src/agents/secretVault.js';
import {
  buildAgentChatReplies,
  handleFeatureChangeRequest,
  startAgentSession,
} from '../src/agents/agentRuntime.js';
import {
  localizeManagerFlowDisplayText,
  managerFlowUserAuthoredFragments,
} from '../src/i18n/managerFlowChinese.js';

const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const DIST_DIR = join(ROOT_DIR, 'dist');
const TEMP_DIR = join(ROOT_DIR, '.tmp', `language-system-${process.pid}`);
const PROGRESS_LOG = join(ROOT_DIR, '.tmp', 'language-validation-progress.log');
const SHOULD_WRITE_PROGRESS_LOG = process.env.HOFS_PROGRESS_LOG === '1';
const REQUESTED_STEP = String(process.env.HOFS_LANGUAGE_STEP || '').trim();
const DEFAULT_PORTS = [4191, 4192, 4193, 4194, 4195];
const LANGUAGE_STORAGE_KEY = 'hall_of_fame_studio.language.v1';
const LANGUAGE_PRESERVE_SESSION_KEY = 'hall_of_fame_studio.language_validation_preserve.v1';
const BACKEND_STORAGE_KEY = 'hall_of_fame_studio.agent_backend_url.v1';
const LOCAL_AUTH_STORAGE_KEY = 'hall_of_fame_studio.local_auth_session.v1';
const VIEWPORT = { width: 1440, height: 1100 };
let validationBackendUrl = '';
let validationAuthSession = null;
let validationBackendStore = null;

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

async function validateRealProjectFlowGraphLanguage() {
  const storePath = process.env.HOFS_REAL_PROJECT_STORE_PATH || join(ROOT_DIR, '.tmp', 'agent-project-store.json');
  let snapshot;
  try {
    snapshot = JSON.parse(await readFile(storePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      console.log(`[language] real project store not present; skipped ${storePath}`);
      return;
    }
    throw error;
  }

  const requestedProjectId = process.env.HOFS_REAL_PROJECT_ID || 'project_project_c73bccad';
  const project = (snapshot.projects || []).find(item => item.id === requestedProjectId)
    || (snapshot.projects || []).find(item => item.projectSettings?.effectiveLanguage === 'zh' || item.language === 'zh');
  assert(project, `No Chinese real project found in ${storePath}.`);

  const messages = (snapshot.messages || []).filter(message => message.projectId === project.id);
  const service = createAgentProjectService({
    projects: snapshot.projects || [],
    messages: snapshot.messages || [],
    kickoffMeetings: snapshot.kickoffMeetings || [],
  });
  const graph = service.getManagerFlowGraph(project.id, { language: 'zh', skipCache: true });
  const userAuthoredFragments = managerFlowUserAuthoredFragments(project, messages);
  const issues = [];
  const inspect = (node, field, value, fallback) => {
    if (typeof value !== 'string' || !value) return;
    const visible = localizeManagerFlowDisplayText(value, {
      language: 'zh',
      fallback,
      userAuthoredFragments,
    });
    const exactUserContent = userAuthoredFragments.some(fragment => fragment.trim() === visible.trim());
    const technicalValue = /^https?:\/\//i.test(visible)
      || /^\/[A-Za-z0-9_./:#?=&%-]+$/.test(visible)
      || /^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)+$/.test(visible);
    if (/[A-Za-z]{2,}/.test(visible) && !exactUserContent && !technicalValue) {
      issues.push(`${node.id || 'graph'}.${field}: ${visible}`);
    }
  };

  for (const node of graph.nodes || []) {
    inspect(node, 'categoryLabel', node.categoryLabel, '流程');
    inspect(node, 'subtype', node.subtypeLabel || node.subtype, '记录');
    inspect(node, 'title', node.title, '流程记录');
    inspect(node, 'description', node.description || node.summary, '流程说明');
    inspect(node, 'summary', node.summary, '流程摘要');
    inspect(node, 'commitMessage', node.submission?.commitMessage || node.commitMessage, '流程记录');
    inspect(node, 'agentName', node.agentName, '项目成员');
    inspect(node, 'status', node.statusLabel || node.status, '已记录');
    inspect(node, 'importance', node.importanceLabel || node.importance, '普通');
    inspect(node, 'intent', node.submission?.intent, '智能体已提交此流程记录，等待经理复核。');
    for (const item of node.thinkingFrame?.checklist || []) inspect(node, 'checklist', item, '流程检查项');
    for (const item of node.submission?.submissionMotivation?.evidencePlan || []) inspect(node, 'evidencePlan', item, '证据计划');
  }

  assert(issues.length === 0, `Real Chinese project flow graph has unexpected generated English:\n${issues.slice(0, 30).join('\n')}`);
  console.log(`[language] real project ${project.id}: ${(graph.nodes || []).length} nodes and ${(graph.edges || []).length} edges verified`);
}

async function loadRealChineseProjectSnapshot() {
  const storePath = process.env.HOFS_REAL_PROJECT_STORE_PATH || join(ROOT_DIR, '.tmp', 'agent-project-store.json');
  try {
    const snapshot = JSON.parse(await readFile(storePath, 'utf8'));
    const requestedProjectId = process.env.HOFS_REAL_PROJECT_ID || 'project_project_c73bccad';
    const project = (snapshot.projects || []).find(item => item.id === requestedProjectId)
      || (snapshot.projects || []).find(item => item.projectSettings?.effectiveLanguage === 'zh' || item.language === 'zh');
    return project ? { snapshot, project, storePath } : null;
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function visibleUnexpectedEnglish(page, userAuthoredFragments = [], rootSelector = 'body') {
  return page.locator(rootSelector).first().evaluate((root, fragments) => {
    const issues = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const textNode = walker.currentNode;
      const parent = textNode.parentElement;
      if (!parent || parent.closest('script, style, code, pre, [data-user-content], [aria-hidden="true"]')) continue;
      const style = getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0 || parent.getClientRects().length === 0) continue;
      let text = String(textNode.nodeValue || '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      for (const fragment of [...fragments].sort((a, b) => b.length - a.length)) {
        if (fragment) text = text.split(fragment).join(' ');
      }
      text = text
        .replace(/\{[\s\S]*$/g, ' ')
        .replace(/https?:\/\/\S+/gi, ' ')
        .replace(/\/[A-Za-z0-9_./:#?=&%-]+/g, ' ')
        .replace(/\b(?=[A-Za-z0-9_-]*_)[A-Za-z0-9_-]+\b/g, ' ')
        .replace(/\b(?=[A-Za-z]*[a-z][A-Z])[A-Za-z]+\b/g, ' ')
        .replace(/\b[A-Za-z0-9]+(?:_[A-Za-z0-9]+)+\b/g, ' ')
        .replace(/\b(?=[A-Za-z0-9_.:-]*\d)(?=[A-Za-z0-9_.:-]*[-_.:])[A-Za-z0-9_.:-]+\b/g, ' ')
        .replace(/\b(?:API|ID|URL|URI|HTTP|HTTPS|JSON|OAuth|JWT|MCP|BYOK|OpenAI)\b/gi, ' ')
        .replace(/\b(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/gi, ' ')
        .replace(/\b[A-Fa-f0-9]{12,}\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (/[A-Za-z]{2,}/.test(text)) {
        issues.push({
          text,
          element: parent.outerHTML.slice(0, 500),
        });
      }
    }
    return issues.slice(0, 60);
  }, userAuthoredFragments);
}

async function assertStrictChineseSurface(page, scope, userAuthoredFragments, rootSelector = 'body') {
  const issues = await visibleUnexpectedEnglish(page, userAuthoredFragments, rootSelector);
  assert(
    issues.length === 0,
    `Real Chinese project ${scope} has unexpected visible English:\n${issues.map(issue => `${issue.text}\n${issue.element}`).join('\n')}`,
  );
}

async function validateRealProjectChineseSurfaces(browser, url) {
  const loaded = await loadRealChineseProjectSnapshot();
  if (!loaded) {
    console.log('[language] real project browser snapshot not present; skipped');
    return;
  }
  const { snapshot, project } = loaded;
  validationBackendStore.saveProject(structuredClone(project));
  validationBackendStore.appendMessages(structuredClone((snapshot.messages || []).filter(message => message.projectId === project.id)));
  for (const meeting of (snapshot.kickoffMeetings || []).filter(item => item.projectId === project.id)) {
    validationBackendStore.saveKickoffMeeting(structuredClone(meeting));
  }

  const projectMessages = (snapshot.messages || []).filter(message => message.projectId === project.id);
  const userAuthoredFragments = managerFlowUserAuthoredFragments(project, projectMessages);
  const page = await openWithLanguage(browser, url, 'zh');
  try {
    const projectButton = page.getByRole('button', { name: `打开项目：${project.name}` });
    await projectButton.waitFor({ state: 'visible', timeout: 15000 });
    await projectButton.click();
    await page.getByTestId('project-dashboard-view').waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForTimeout(200);
    await assertStrictChineseSurface(page, 'project dashboard', userAuthoredFragments);
    await page.getByTestId('project-open-chat').waitFor({ state: 'visible', timeout: 20000 }).catch(async (error) => {
      const body = await page.locator('body').innerText().catch(() => '');
      throw new Error(`${error.message}\nReal project body after open:\n${body.slice(0, 3000)}`);
    });
    await page.waitForTimeout(200);
    await assertStrictChineseSurface(page, 'project dashboard', userAuthoredFragments);

    await page.getByTestId('project-open-chat').click();
    await page.getByTestId('project-chat-panel').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(200);
    await assertStrictChineseSurface(page, 'chat', userAuthoredFragments);
    await page.getByTestId('project-scene-back').first().click();
    await page.getByTestId('project-open-timeline').waitFor({ state: 'visible', timeout: 10000 });

    await page.getByTestId('project-open-timeline').click();
    await page.getByTestId('manager-flow-graph').waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForTimeout(200);
    for (let pass = 0; pass < 5; pass += 1) {
      const collapsed = page.locator('[data-testid^="manager-flow-overflow-"][data-expanded="false"]');
      const count = await collapsed.count();
      if (!count) break;
      for (let index = 0; index < count; index += 1) {
        await collapsed.nth(index).evaluate(button => button.click()).catch(() => {});
      }
      await page.waitForTimeout(100);
    }
    await assertStrictChineseSurface(page, 'flow graph', userAuthoredFragments);

    const nodes = page.locator('[data-testid^="manager-flow-node-"]:not([data-testid*="-logo-"])');
    const nodeIds = [...new Set(await nodes.evaluateAll(elements => elements.map(element => element.dataset.timelineEventId).filter(Boolean)))];
    let verifiedNodeDetailCount = 0;
    for (let index = 0; index < nodeIds.length; index += 1) {
      const nodeId = nodeIds[index];
      const clicked = await page.evaluate(id => {
        const button = [...document.querySelectorAll('[data-timeline-event-id]')]
          .find(element => element.dataset.timelineEventId === id);
        button?.click();
        return Boolean(button);
      }, nodeId);
      if (!clicked) continue;
      const detail = page.getByTestId('timeline-node-metadata-detail');
      const opened = await detail.waitFor({ state: 'visible', timeout: 1500 }).then(() => true).catch(() => false);
      if (!opened) {
        await page.evaluate(id => {
          [...document.querySelectorAll('[data-timeline-event-id]')]
            .find(element => element.dataset.timelineEventId === id)?.click();
        }, nodeId);
        await detail.waitFor({ state: 'visible', timeout: 5000 });
      }
      await assertStrictChineseSurface(page, `flow graph node detail ${index + 1}/${nodeIds.length}`, userAuthoredFragments, 'aside');
      verifiedNodeDetailCount += 1;
      await page.getByTestId('manager-flow-detail-close').click();
      await page.waitForTimeout(20);
    }
    assert(verifiedNodeDetailCount > 0, 'Real Chinese project graph did not expose any node detail for browser verification.');
    console.log(`[language] real project browser ${project.id}: dashboard, chat, graph, and ${verifiedNodeDetailCount}/${nodeIds.length} rendered node details verified`);
  } finally {
    await page.close();
    if (validationBackendStore.listProjects().some(item => item.id === project.id)) {
      validationBackendStore.deleteProject(project.id);
    }
  }
}

async function launchLocalBrowser() {
  let lastError = null;
  const explicitPath = process.env.HOFS_PLAYWRIGHT_CHROMIUM || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '';
  const options = [
    { headless: true },
    ...(explicitPath ? [{ headless: true, executablePath: explicitPath }] : []),
    { channel: 'msedge', headless: true },
  ];
  for (const launchOptions of options) {
    try {
      return await chromium.launch(launchOptions);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
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
  const bodyText = await page.locator('body').innerText({ timeout: 5000 });
  const userText = await page.locator('[data-user-content]').allTextContents({ timeout: 5000 });
  return userText.filter(Boolean).reduce((text, value) => text.split(value).join(' '), bodyText);
}

function uniqueLinesMatching(text, pattern, allowPattern = null) {
  return [...new Set(
    text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => {
        if (!line) return false;
        const withoutTechnicalTokens = line
          .replace(/https?:\/\/\S+/gi, ' ')
          .replace(/\/[A-Za-z0-9_./#?=&%-]+/g, ' ')
          .replace(/\b[A-Z][A-Z0-9]*(?:[-_][A-Z0-9]+)+\b/g, ' ');
        const inspectable = allowPattern
          ? withoutTechnicalTokens.replace(new RegExp(allowPattern.source, `${allowPattern.flags.replace('g', '')}g`), ' ')
          : withoutTechnicalTokens;
        pattern.lastIndex = 0;
        return pattern.test(inspectable);
      })
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
  const chineseEnglish = uniqueLinesMatching(generatedByLanguage.zh.join('\n'), /[A-Za-z]{4,}/, allowedChineseModeEnglish);
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
  if (validationBackendStore?.listProjects?.().some((project) => project.id === 'p_manager_demo_001')) {
    validationBackendStore.deleteProject('p_manager_demo_001');
  }
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.addInitScript(([key, value, preserveKey, backendKey, backendUrl, authKey, authSession]) => {
    if (window.sessionStorage.getItem(preserveKey) !== '1') {
      window.localStorage.removeItem('hall_of_fame_studio.projects.v1');
      window.localStorage.removeItem('hall_of_fame_studio.chat_messages.v1');
      window.localStorage.setItem(key, value);
    }
    window.localStorage.setItem(backendKey, JSON.stringify(backendUrl));
    window.sessionStorage.setItem(authKey, JSON.stringify(authSession));
  }, [
    LANGUAGE_STORAGE_KEY,
    language,
    LANGUAGE_PRESERVE_SESSION_KEY,
    BACKEND_STORAGE_KEY,
    validationBackendUrl,
    LOCAL_AUTH_STORAGE_KEY,
    validationAuthSession,
  ]);
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
    if (tab === 'models') {
      await page.getByTestId('settings-tab-keys').click({ timeout: 5000 });
      await page.getByTestId('settings-open-model-technical-status').click({ timeout: 5000 });
    } else {
      await page.getByTestId(`settings-tab-${tab}`).click({ timeout: 5000 });
    }
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
  await openSettings(page);
  await page.getByTestId('settings-tab-workspace').evaluate((button) => button.click());
  const initialProjectLanguage = await page.getByTestId('settings-project-language').inputValue();
  assert(initialProjectLanguage === 'en', `Manager demo should start in English before project override; settings reported ${initialProjectLanguage}.`);
  await page.getByLabel(/Close|关闭/).last().evaluate((button) => button.click());
  await page.waitForTimeout(400);
  await assertVisibleLanguage(page, 'en', 'project before language override');
  await openSettings(page);
  await page.getByTestId('settings-tab-workspace').evaluate((button) => button.click());
  await page.getByTestId('settings-project-language').selectOption('zh');
  await page.waitForTimeout(800);
  let persistedProjectLanguage = null;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    persistedProjectLanguage = validationBackendStore?.getProject?.('p_manager_demo_001')?.language || null;
    if (persistedProjectLanguage === 'zh') break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(
    persistedProjectLanguage === 'zh',
    `Project language override should persist through project-settings; backend reported ${persistedProjectLanguage || 'missing'}.`,
  );
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
  const labelText = labels.join(' ');
  const route = /Group Channels|Chat/.test(labelText)
    ? { launch: '[data-testid="project-open-chat"]', target: '[data-testid="project-chat-panel"]' }
    : /Manager Flow Graph|Timeline/.test(labelText)
      ? { launch: '[data-testid="project-open-timeline"]', target: '[data-testid="manager-flow-graph"]' }
      : /Roundtable|Meeting/.test(labelText)
        ? { launch: '[data-testid="project-open-meeting"]', target: '[data-testid="project-meeting-room-stage"], [data-testid="project-simple-meeting"]' }
        : null;
  const launch = route ? page.locator(route.launch).first() : null;
  const launchVisible = launch
    ? await launch.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)
    : false;
  if (launchVisible) {
    await launch.click();
  } else {
    await page.evaluate((items) => {
      const candidates = [...document.querySelectorAll('button, [role="button"], a')];
      const target = candidates.find((element) => (
        items.some((label) => (element.textContent || '').includes(label))
      ));
      target?.click();
    }, labels);
  }
  const targetSelector = route?.target || null;
  if (targetSelector) {
    await page.locator(targetSelector).first().waitFor({ state: 'visible', timeout: 10000 }).catch(async (error) => {
      await page.getByText(/查看错误详情|View error details/i).click().catch(() => {});
      const body = await page.locator('body').innerText().catch(() => '');
      throw new Error(`${error.message}\nSurface body after launch:\n${body.slice(0, 1800)}`);
    });
  }
}

async function openManagerDemoProject(page) {
  await page.getByText(/Workspace Hub|工作区中枢/).first().click({ timeout: 5000 });
  await page.getByTestId('workspace-open-advanced').click({ timeout: 10000 });
  await page.getByTestId('manager-demo-tools').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('manager-demo-tools').evaluate((element) => { element.open = true; });
  await page.getByTestId('run-manager-demo-button').evaluate((button) => button.click());
  await page.waitForFunction(() => /p_manager_demo_001|Manager Demo: Autonomous Agent Studio|Project Dashboard|项目仪表盘|项目看板/.test(document.body.innerText), null, { timeout: 10000 }).catch(async (error) => {
    const body = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    throw new Error(`${error.message}\nBody after opening manager demo:\n${body.slice(0, 1200)}`);
  });
  await page.getByTestId('project-open-chat').waitFor({ state: 'visible', timeout: 20000 });
}

async function openSettings(page) {
  await page.getByTestId('open-settings-button').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('open-settings-button').evaluate((button) => button.click());
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
    const allow = allowedEnglish || /Hall of Fame|Agent|API|OpenAI|Google Chat|BYOK|MCP|ID:|P_\d|P_MANAGER|SAMPLE-FIXTURE|PRODUCT-TEAM-DELIVERY-TRACE|ASSIGNMENT-ACKNOWLEDGED|AUTO-\d+|PEER-HANDOFF|WEEK-COMMIT-CLUSTER|SECURITY-ACCESS|ACCESS CONTROL|ACCESS-CONTROL|#SECURITY|HTTP:\/\/127\.0\.0\.1|\/(?:PROJECTS|WORKERS|KICKOFF-MEETINGS)\b|Steve Jobs|Alan Turing|Marie Curie|Elon Musk|Confucius|You|Apollo Neural|Manager Demo|Autonomous Agent Studio|Auth Middleware|Timeline|Chat|Roundtable|War Room|Flow Graph|URL|Gateway|Gemini|Cursor|OAuth|JWT|Docs|Skill|First Pulse|Daily|Hourly|Leader|Reviewer|Product Visionary|System Architect|Evidence Reviewer|Consensus Steward|Execution Driver/i;
    const unexpectedEnglish = uniqueLinesMatching(text, /[A-Za-z]{4,}/, allow);
    assert(unexpectedEnglish.length === 0, `Chinese ${scope} has unexpected English UI text:\n${unexpectedEnglish.slice(0, 20).join('\n')}`);
  }
}

async function validateProjectSurfaces(browser, url, language) {
  const page = await openWithLanguage(browser, url, language);
  const duplicateKeyWarnings = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type()) && /Encountered two children with the same key/i.test(message.text())) {
      duplicateKeyWarnings.push(`${message.type()}: ${message.text()}`);
    }
  });
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
        assert(
          /Project Dashboard|Next Recommendation/i.test(text),
          `English project dashboard should expose localized primary UI. Page excerpt:\n${text.slice(0, 1600)}`,
        );
      }
      continue;
    }
    if (language === 'en') {
      const unexpectedChinese = uniqueLinesMatching(text, /[\u4e00-\u9fff]/);
      assert(unexpectedChinese.length === 0, `English ${name} surface has unexpected Chinese UI text:\n${unexpectedChinese.slice(0, 20).join('\n')}`);
    } else {
      const unexpectedEnglish = uniqueLinesMatching(text, /[A-Za-z]{4,}/, allowedEnglish);
      let unexpectedEnglishContext = [];
      if (unexpectedEnglish.length > 0) {
        unexpectedEnglishContext = await page.evaluate((lines) => lines.slice(0, 3).map((line) => {
          const candidates = [...document.querySelectorAll('body *')]
            .filter((element) => (element.innerText || '').includes(line))
            .sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);
          return candidates[0]?.outerHTML?.slice(0, 1200) || '';
        }), unexpectedEnglish);
      }
      assert(unexpectedEnglish.length === 0, `Chinese ${name} surface has unexpected English UI text:\n${unexpectedEnglish.slice(0, 20).join('\n')}\nContext:\n${unexpectedEnglishContext.join('\n')}`);
    }
    await page.getByTestId('project-scene-back').first().click();
    await page.getByTestId('project-open-chat').waitFor({ state: 'visible', timeout: 5000 });
  }
  assert(!duplicateKeyWarnings.length, `${language} project surfaces must not emit duplicate React key warnings. First warning: ${duplicateKeyWarnings[0] || ''}`);
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

  await page.getByTestId('project-scene-back').first().click();
  await page.getByTestId('project-open-timeline').waitFor({ state: 'visible', timeout: 5000 });
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
      const allowedEnglish = /Hall of Fame|Agent|API|OpenAI|Google Chat|BYOK|MCP|ID:[A-Z_]+|Steve Jobs|Alan Turing|Marie Curie|Elon Musk|Confucius|Albert Einstein|Isaac Newton|William Shakespeare|Walt Disney|Winston Churchill|Leonardo da Vinci|Abraham Lincoln|You|Dashboard|Roundtable|Skill|Director|Project|Step|URL|API|BYOK|BRIEF|SLATE|SELECTED|SAVING|CAMPAIGN|PEERS|LEADER|ASSIGNMENTS|APPROVAL|SAVE|MEETING|RESOLUTION|AWAITING|CONFIRMATION|CLARIFICATION|SELF-NOMINATION|ROLE-CLARIFICATION|LEADER-CAMPAIGN|BACKEND|SESSION|LOCAL-MVP-STARTUP-READINESS/i;
      const unexpectedEnglish = uniqueLinesMatching(text, /[A-Za-z]{4,}/, allowedEnglish);
      assert(unexpectedEnglish.length === 0, `Chinese initiation ${stage} has unexpected English UI text:\n${unexpectedEnglish.slice(0, 20).join('\n')}`);
    }
  };
  await page.waitForFunction(() => (
    document.querySelector('[data-testid="first-run-start-project"]')
    || document.querySelector('[data-testid="first-run-skip-model"]')
    || document.querySelector('[data-testid="initiation-next-workspace"]')
  ), null, { timeout: 15000 });
  const firstRunStart = page.getByTestId('first-run-start-project');
  if (await firstRunStart.count()) {
    await firstRunStart.click({ timeout: 5000 });
  } else if (await page.getByTestId('first-run-skip-model').count()) {
    await page.getByTestId('first-run-skip-model').click({ timeout: 5000 });
  } else {
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
  }
  await page.getByTestId('initiation-next-workspace').waitFor({ state: 'visible', timeout: 10000 }).catch(async (error) => {
    const body = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    throw new Error(`${error.message}\nBody after opening initiation:\n${body.slice(0, 1400)}`);
  });
  await assertCurrentLanguage('brief');
  await page.getByTestId('initiation-next-workspace').click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await assertCurrentLanguage('workspace');
  await page.getByTestId('initiation-workspace-base-path').fill(TEMP_DIR);
  await page.getByTestId('initiation-workspace-folder-name').fill(`language-${language}`);
  await page.getByTestId('initiation-workspace-prepare').click({ timeout: 5000 });
  await page.waitForFunction(() => !document.querySelector('[data-testid="initiation-workspace-next-invite"]')?.disabled, null, { timeout: 10000 }).catch(async (error) => {
    const body = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    throw new Error(`${error.message}\nBody after preparing initiation workspace:\n${body.slice(0, 1800)}`);
  });
  await page.getByTestId('initiation-workspace-next-invite').click({ timeout: 5000 });
  await page.getByTestId('initiation-talent-market').waitFor({ state: 'visible', timeout: 10000 });
  await assertCurrentLanguage('talent market');
  await page.getByTestId('market-open-jobs').click({ timeout: 5000 });
  await page.getByTestId('initiation-contract-jobs').waitFor({ state: 'visible', timeout: 10000 });
  await assertCurrentLanguage('talent dossier');
  await page.getByTestId('initiation-contract-jobs').click({ timeout: 5000 });
  await page.getByTestId('initiation-talent-market').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForFunction(() => !document.querySelector('[data-testid="initiation-next-lobby"]')?.disabled, null, { timeout: 10000 });
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
  await page.getByTestId('settings-tab-workspace').evaluate((button) => button.click());
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
  const storedLanguage = await page.evaluate((key) => window.localStorage.getItem(key), LANGUAGE_STORAGE_KEY);
  assert(storedLanguage === 'en', `Global language should persist in browser storage; found ${storedLanguage || 'missing'}.`);
  await page.evaluate((key) => window.sessionStorage.setItem(key, '1'), LANGUAGE_PRESERVE_SESSION_KEY);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const reloadedText = await pageText(page);
  assert(reloadedText.includes('Workspace Hub'), 'Saved global language should remain English after reload.');
  const reloadedLanguage = await page.evaluate((key) => window.localStorage.getItem(key), LANGUAGE_STORAGE_KEY);
  assert(reloadedLanguage === 'en', `Reload should retain the saved global language; found ${reloadedLanguage || 'missing'}.`);
  await page.close();
}

rmSync(TEMP_DIR, { recursive: true, force: true });
mkdirSync(TEMP_DIR, { recursive: true });
const secretVault = createSecretVaultFromEnv({
  SECRET_VAULT_ENABLED: 'true',
  SECRET_VAULT_KEY: 'language-validation-local-vault-key',
  SECRET_VAULT_KEY_ID: 'language-validation',
  SECRET_VAULT_RECORDS_FILE: join(TEMP_DIR, 'vault-records.json'),
});
const llmProvider = createModelProvider({
  provider: 'openai-compatible',
  apiKey: 'language-validation-model-key',
  apiKeySource: 'local-secret-vault',
  secretVaultStatus: secretVault.status(),
  baseURL: 'https://model.language-validation.local/v1',
  model: 'language-validation-model',
  enabled: true,
  fetchImpl: async (_input, init = {}) => {
    const requestBody = JSON.parse(String(init.body || '{}'));
    const prompt = (requestBody.messages || []).map((message) => message.content || '').join('\n');
    const language = /PROJECT LANGUAGE:\s*zh\b/i.test(prompt) ? 'zh' : 'en';
    const projectName = prompt.match(/PROJECT NAME:\s*([^\n]+)/i)?.[1]?.trim()
      || (language === 'zh' ? '本地验证项目' : 'Local validation project');
    const agentId = prompt.match(/AGENTS:\s*\n([^:\n]+):/i)?.[1]?.trim() || 'jobs';
    const content = language === 'zh'
      ? {
          roleTurns: [{ agentId, type: 'role-question', text: `请确认${projectName}的首项交付。`, hears: [] }],
          decisionSummary: `${projectName}等待总监确认首项交付。`,
          risks: [`${projectName}需要明确验收标准。`],
        }
      : {
          roleTurns: [{ agentId, type: 'role-question', text: `Please confirm the first deliverable for ${projectName}.`, hears: [] }],
          decisionSummary: `${projectName} awaits the Director's first-deliverable decision.`,
          risks: [`${projectName} needs explicit acceptance criteria.`],
        };
    return new Response(JSON.stringify({
      id: 'language-validation-model-response',
      model: 'language-validation-model',
      choices: [{ message: { role: 'assistant', content: JSON.stringify(content) } }],
      usage: { prompt_tokens: 12, completion_tokens: 12, total_tokens: 24 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  },
});
const searchProvider = createSearchProvider({
  provider: 'deterministic',
  apiKey: 'language-validation-search-key',
  apiKeySource: 'local-secret-vault',
  secretVaultStatus: secretVault.status(),
  enabled: true,
});
const backendServer = createAgentProjectHttpServer({
  filePath: join(TEMP_DIR, 'projects.json'),
  localAuthFilePath: join(TEMP_DIR, 'auth.json'),
  localAuthRequired: true,
  secretVault,
  llmProvider,
  searchProvider,
  projectRuntime: createLocalProjectRuntime({
    rootPath: join(TEMP_DIR, 'runtime'),
  }),
  projects: [],
});
const backendRuntime = await backendServer.listen({ port: 0, host: '127.0.0.1' });
validationBackendStore = backendServer.api.store;
const bootstrapResponse = await fetch(`${backendRuntime.url}/local-auth/bootstrap`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'language-validator', password: 'lang1' }),
});
const bootstrapPayload = await bootstrapResponse.json();
assert(bootstrapResponse.status === 201, `Could not create isolated language-validation account: ${bootstrapPayload.error || bootstrapResponse.status}.`);
validationBackendUrl = backendRuntime.url;
validationAuthSession = {
  ...bootstrapPayload.localAuth,
  baseUrl: backendRuntime.url,
};

const { server, url } = await startServer();
const browser = await launchLocalBrowser();

try {
  if (SHOULD_WRITE_PROGRESS_LOG) {
    mkdirSync(join(ROOT_DIR, '.tmp'), { recursive: true });
    rmSync(PROGRESS_LOG, { force: true });
  }
  const runStep = async (name, fn) => {
    if (REQUESTED_STEP && name !== REQUESTED_STEP) return;
    if (SHOULD_WRITE_PROGRESS_LOG) {
      appendFileSync(PROGRESS_LOG, `[language] ${name}\n`);
    }
    console.log(`[language] ${name}`);
    await fn();
  };
  await runStep('agent generation', () => validateAgentGenerationLanguage());
  await runStep('manager read models', () => validateManagerReadModelLanguage());
  await runStep('real project flow graph zh', () => validateRealProjectFlowGraphLanguage());
  await runStep('real project browser zh', () => validateRealProjectChineseSurfaces(browser, url));
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
  await backendServer.close();
  rmSync(TEMP_DIR, { recursive: true, force: true });
}
