import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = [
  readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8'),
  readFileSync(new URL('../src/meeting/MeetingInputPanel.jsx', import.meta.url), 'utf8'),
  readFileSync(new URL('../src/project/ProjectChatPanel.jsx', import.meta.url), 'utf8'),
  readFileSync(new URL('../src/project/AdvancedProjectChat.jsx', import.meta.url), 'utf8'),
  readFileSync(new URL('../src/project/AdvancedProjectTimeline.jsx', import.meta.url), 'utf8'),
  readFileSync(new URL('../src/workspace/AdvancedWorkspaceView.jsx', import.meta.url), 'utf8'),
  readFileSync(new URL('../src/navigation/ProductSidebar.jsx', import.meta.url), 'utf8'),
  readFileSync(new URL('../src/settings/SettingsDialogShell.jsx', import.meta.url), 'utf8'),
].join('\n');
const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const styleSource = readFileSync(new URL('../src/styles/globalStyles.js', import.meta.url), 'utf8');
const indexStyleSource = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

test('primary keyboard focus is visible across buttons and form controls', () => {
  for (const selector of ['button:focus-visible', 'input:focus-visible', 'textarea:focus-visible', 'select:focus-visible']) {
    assert.match(styleSource, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(styleSource, /outline: 2px solid #8f1e18/);
});

test('primary meeting and chat inputs expose screen-reader labels', () => {
  for (const label of ['会议发言', '语音输入', '返回项目', '发送项目消息', '项目群聊频道']) {
    assert.match(source, new RegExp(label));
  }
});

test('settings opens as a named dialog with a reachable close action', () => {
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /aria-labelledby="local-settings-title"/);
  assert.match(source, /id="local-settings-title"/);
});

test('backend project cards are named buttons that can be opened without a mouse', () => {
  assert.match(source, /aria-label=\{`打开项目：\$\{proj\.name\}`\}/);
  assert.match(source, /type="button"[\s\S]{0,180}aria-label=\{`打开项目：\$\{proj\.name\}`\}/);
});

test('sidebar icon actions expose ordinary Chinese names', () => {
  assert.match(source, /aria-label="创建项目"/);
  assert.match(source, /'展开侧边栏' : '收起侧边栏'/);
  assert.match(source, /t\('nav\.workspaceHub'\)/);
  assert.match(source, /t\('nav\.talentMarket'\)/);
  assert.match(source, /t\('nav\.activeProjects'\)/);
  assert.match(source, /activeLanguage === 'zh' \? '总' : 'D'/);
  assert.match(source, /activeLanguage === 'zh' \? '打开设置' : 'Open settings'/);
});

test('application uses the shared product sidebar without dropping project navigation', () => {
  assert.match(appSource, /import ProductSidebar from '\.\/navigation\/ProductSidebar\.jsx'/);
  assert.match(appSource, /<ProductSidebar/);
  assert.match(appSource, /projects=\{projects\}/);
  assert.match(appSource, /onProject=\{navToProject\}/);
  assert.match(appSource, /onCreateProject=\{navToInitiation\}/);
  assert.match(appSource, /onSettings=\{openProductSettings\}/);
});

test('sample data is preserved behind an explicitly named optional control', () => {
  assert.match(source, /data-testid="manager-demo-tools"/);
  assert.match(source, /示例数据与产品检查/);
  assert.match(source, /data-testid="run-manager-demo-button"/);
});

test('legacy compact text classes render at a readable minimum size', () => {
  for (const size of [8, 9, 10]) {
    assert.match(indexStyleSource, new RegExp(`class~="text-\\[${size}px\\]"`));
  }
  assert.match(indexStyleSource, /font-size: 0\.75rem !important/);
  assert.doesNotMatch(styleSource, /font-size:\s*(?:8|9|10)px/);
});
