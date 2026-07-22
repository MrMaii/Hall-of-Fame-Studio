import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const firstRunSource = readFileSync(new URL('../src/onboarding/LocalFirstRunFlow.jsx', import.meta.url), 'utf8');
const initiationSource = readFileSync(new URL('../src/onboarding/ProjectInitiationFlowView.jsx', import.meta.url), 'utf8');
const resultSource = readFileSync(new URL('../src/onboarding/ProjectInitiationResultStep.jsx', import.meta.url), 'utf8');
const workspaceSource = readFileSync(new URL('../src/onboarding/ProjectInitiationWorkspaceStep.jsx', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../src/settings/SettingsModalView.jsx', import.meta.url), 'utf8');
const localRuntimeSource = readFileSync(new URL('../src/agents/localProjectRuntime.js', import.meta.url), 'utf8');

test('Chinese first-use status messages stay plain and do not expose backend operations by default', () => {
  for (const label of [
    '本地服务地址已保存；首次创建项目前请运行健康检查',
    '运行健康检查',
    '配置模型后即可开始 Agent 工作',
    '你可以继续填写项目信息和准备文件夹；开始立项会议前需要完成模型设置。',
    '操作没有完成',
    '请重试；如果问题持续出现，请打开设置检查本地服务和模型。',
    '查看技术信息',
  ]) {
    assert.ok(`${settingsSource}\n${initiationSource}`.includes(label), `missing plain Chinese first-use label: ${label}`);
  }

  assert.ok(initiationSource.includes('data-testid="initiation-startup-technical-details"'));
  assert.ok(initiationSource.includes('<div data-no-localize="" className="mt-2 break-all">{backendStation.lastAction'));
  assert.ok(initiationSource.includes('<div data-no-localize="" className="mt-1 break-all">{backendStation.error}</div>'));
  assert.ok(initiationSource.indexOf('/local-mvp-startup-readiness') > initiationSource.indexOf('data-testid="initiation-startup-technical-details"'));
});

test('postponing model setup describes the real limit before project initiation', () => {
  assert.ok(firstRunSource.includes('暂不配置，先准备项目信息'));
  assert.ok(firstRunSource.includes('开始智能体工作前仍需完成模型设置'));
  assert.ok(!firstRunSource.includes('开始 Agent 工作前仍需完成模型设置'));
  assert.ok(!firstRunSource.includes('稍后配置，先创建项目'));
  assert.ok(appSource.includes('const initiationCanStartKickoff = initiationStartupAllowsKickoff && initiationWorkspaceReady;'));
});

test('an initiation failure stays on the failing steps instead of following the user back into setup', () => {
  assert.ok(appSource.includes("&& !['brief', 'workspace', 'invite'].includes(initiationStep)"));
});

test('a failed live meeting turn releases the typing lock and restores the director input', () => {
  const submitStart = appSource.indexOf('const submitInitiationMeetingInput = async');
  const submitEnd = appSource.indexOf('\n    return (', submitStart);
  const submitSource = appSource.slice(submitStart, submitEnd);
  assert.ok(submitSource.includes('setRoomUserIntentActive(false);'));
  assert.ok(submitSource.includes('setRoomInput(text);'));
  assert.ok(submitSource.includes('智能体回复没有完成。请重试；如果仍失败，请结束会议并在设置中测试模型。'));
});

test('project approval opens the dashboard before awaiting broad read-model hydration', () => {
  const approvalStart = appSource.indexOf('const approveInitiationProject = async');
  const approvalEnd = appSource.indexOf('const enterProjectScene =', approvalStart);
  const approvalSource = appSource.slice(approvalStart, approvalEnd);
  const refreshStart = approvalSource.indexOf('kickoffReadModelRefreshPromise = refreshProjectInitiationReadModels');
  const routeOpen = approvalSource.indexOf("setActiveRoute('project_detail');");
  const refreshAwait = approvalSource.indexOf('kickoffReadModelRefresh = await kickoffReadModelRefreshPromise');

  assert.ok(refreshStart >= 0);
  assert.ok(routeOpen > refreshStart);
  assert.ok(refreshAwait > routeOpen);
});

test('configured language model unlocks kickoff while optional search remains unconfigured', () => {
  assert.ok(appSource.includes("import { initiationStartupAllowsModelWork } from './onboarding/initiationStartupReadiness.js';"));
  assert.ok(appSource.includes('const startupAllowsConfiguredModel = (readiness) => initiationStartupAllowsModelWork({'));
  assert.ok(appSource.includes('if (startupAllowsConfiguredModel(startupReadiness) || isDevelopmentInitiationFallbackEnabled()) {'));
  assert.ok(appSource.includes('const initiationStartupReadyForFirstRun = initiationStartupAllowsModelWork({'));
  assert.ok(initiationSource.includes('!isInitiationMeetingStep && !initiationStartupReadyForFirstRun && ('));
});

test('native folder picker exposes waiting, cancelled, selected, and failed states', () => {
  for (const contract of [
    'pickingFolder: false',
    "notice: activeLanguage === 'zh'",
    '未选择位置，你仍可直接填写上级文件夹。',
    '请填写上级文件夹和项目文件夹名称。',
    '创建项目文件夹等待时间过长，请重试。',
  ]) {
    assert.ok(appSource.includes(contract), `missing folder picker result contract: ${contract}`);
  }

  for (const label of [
    'initiation-workspace-picker-notice',
    '正在等待位置选择…',
    'disabled={workspaceDraft.pickingFolder}',
  ]) {
    assert.ok(workspaceSource.includes(label), `missing folder picker UI feedback: ${label}`);
  }
});

test('local installs default project workspaces inside the repository instead of a system root', () => {
  assert.ok(appSource.includes("const DEFAULT_INITIATION_WORKSPACE_BASE_PATH = './projects';"));
  assert.ok(!appSource.includes("'C:\\\\projects'"));
  assert.ok(appSource.includes("const separator = /^[a-z]:/i.test(base) || base.includes('\\\\') ? '\\\\' : '/';"));
  assert.ok(appSource.includes('payload.unsupported'));
  assert.ok(appSource.includes('当前系统请直接填写上级文件夹，然后创建项目文件夹。'));
  assert.ok(localRuntimeSource.includes('unsupported: true'));
  assert.ok(!localRuntimeSource.includes("throw new Error('Native folder picker is only implemented for Windows local runtime.')"));
});

test('the team-selection journey does not render the corrupted Chinese use-window label', () => {
  assert.ok(appSource.includes("${localizeText(agent.category, language)}使用窗口"));
  assert.ok(!appSource.includes('浣跨敤绐楀彛'));
});

test('the project approval result follows the selected Chinese interface language', () => {
  assert.ok(initiationSource.includes('activeLanguage={activeLanguage}'));
  for (const label of ['第 6 步 / 立项结果', '立项结果：待总监确认', '立项会议五项确认', '02 · 确认各自职责', '04 · 确定下一步', '05 · 确认最终交付物', '生成项目并进入看板']) {
    assert.ok(resultSource.includes(label), `missing Chinese project approval label: ${label}`);
  }
  assert.ok(!resultSource.includes('立项结果：已批准'));
});
